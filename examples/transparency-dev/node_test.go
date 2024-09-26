package proof

import (
	"math/bits"
	"testing"

	"github.com/transparency-dev/merkle/compact"
	// "github.com/transparency-dev/merkle/compact"
)

// Nodes contains information on how to construct a log Merkle tree proof. It
// supports any proof that has at most one ephemeral node, such as inclusion
// and consistency proofs defined in RFC 6962.
type Nodes struct {
	// IDs contains the IDs of non-ephemeral nodes sufficient to build the proof.
	// If an ephemeral node is needed for a proof, it can be recomputed based on
	// a subset of nodes in this list.
	IDs []compact.NodeID
	// begin is the beginning index (inclusive) into the IDs[begin:end] subslice
	// of the nodes which will be used to re-create the ephemeral node.
	begin int
	// end is the ending (exclusive) index into the IDs[begin:end] subslice of
	// the nodes which will be used to re-create the ephemeral node.
	end int
	// ephem is the ID of the ephemeral node in the proof. This node is a common
	// ancestor of all nodes in IDs[begin:end]. It is the node that otherwise
	// would have been used in the proof if the tree was perfect.
	ephem compact.NodeID
}

func (n Nodes) skipFirst() Nodes {
	n.IDs = n.IDs[1:]
	// Fixup the indices into the IDs slice.
	if n.begin < n.end {
		n.begin--
		n.end--
	}
	return n
}

func reverse(ids []compact.NodeID) {
	for i, j := 0, len(ids)-1; i < j; i, j = i+1, j-1 {
		ids[i], ids[j] = ids[j], ids[i]
	}
}

// nodes returns the node IDs necessary to prove that the (level, index) node
// is included in the Merkle tree of the given size.
func nodes(index uint64, level uint, size uint64) Nodes {
	// Compute the `fork` node, where the path from root to (level, index) node
	// diverges from the path to (0, size).
	//
	// The sibling of this node is the ephemeral node which represents a subtree
	// that is not complete in the tree of the given size. To compute the hash
	// of the ephemeral node, we need all the non-ephemeral nodes that cover the
	// same range of leaves.
	//
	// The `inner` variable is how many layers up from (level, index) the `fork`
	// and the ephemeral nodes are.
	inner := bits.Len64(index^(size>>level)) - 1
	fork := compact.NewNodeID(level+uint(inner), index>>inner)

	begin, end := fork.Coverage()
	left := compact.RangeSize(0, begin)
	right := compact.RangeSize(end, size)

	node := compact.NewNodeID(level, index)
	// Pre-allocate the exact number of nodes for the proof, in order:
	// - The seed node for which we are building the proof.
	// - The `inner` nodes at each level up to the fork node.
	// - The `right` nodes, comprising the ephemeral node.
	// - The `left` nodes, completing the coverage of the whole [0, size) range.
	allocation := make([]compact.NodeID, 0, 1+inner+right+left)
	// fmt.Println(allocation)
	nodes := append(allocation, node)

	// The first portion of the proof consists of the siblings for nodes of the
	// path going up to the level at which the ephemeral node appears.
	for ; node.Level < fork.Level; node = node.Parent() {
		nodes = append(nodes, node.Sibling())
	}
	// This portion of the proof covers the range [begin, end) under it. The
	// ranges to the left and to the right from it remain to be covered.

	// Add all the nodes (potentially none) that cover the right range, and
	// represent the ephemeral node. Reverse them so that the rehash method can
	// process hashes in the convenient order, from lower to upper levels.
	len1 := len(nodes)
	nodes = compact.RangeNodes(end, size, nodes)
	reverse(nodes[len(nodes)-right:])
	len2 := len(nodes)
	// Add the nodes that cover the left range, ordered increasingly by level.
	nodes = compact.RangeNodes(0, begin, nodes)
	reverse(nodes[len(nodes)-left:])

	// nodes[len1:len2] contains the nodes representing the ephemeral node. If
	// it's empty, make it zero. Note that it can also contain a single node.
	// Depending on the preference of the layer above, it may or may not be
	// considered ephemeral.
	if len1 >= len2 {
		len1, len2 = 0, 0
	}

	return Nodes{IDs: nodes, begin: len1, end: len2, ephem: fork.Sibling()}
}

func TestNewNodeID(t *testing.T) {
	// n0 := compact.NewNodeID(uint(23), uint64(42))
	// n1 := n0.Parent()
	// n2 := n0.Sibling()
	// r0, r1 := n0.Coverage()
	// fmt.Println(n0, n1, n2, r0, r1)
	//
	// fmt.Println(bits.Len64(255))
	// fmt.Println(bits.Len32(256))

	// fmt.Println(bits.trailing_zeros_64(uint64(875214)))
	// fmt.Println(compact.RangeNodes(0, 15, []compact.NodeID{}))

	// fmt.Println(bits.ones_count_64(123))

	// fmt.Println(compact.Decompose(13, 27))
	// fmt.Println(compact.RangeSize(13, 27))

	// n0 := nodes(1, 2, 3)
	// fmt.Println(n0.IDs)

	// p0, _ := proof.inclusion(15, 35)

	// fmt.Println(p0.IDs)
	// fmt.Println(p0.Ephem())

	// p0, _ := proof.consistency(15, 35)

	// fmt.Println(p0.IDs)

}
