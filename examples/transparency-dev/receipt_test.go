package proof

import (
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"testing"

	"github.com/transparency-dev/merkle"
	"github.com/transparency-dev/merkle/compact"
	"github.com/transparency-dev/merkle/rfc6962"
)

// Tree implements an append-only Merkle tree. For testing.
type Tree struct {
	hasher merkle.LogHasher
	size   uint64
	hashes [][][]byte // Node hashes, indexed by node (level, index).
}

// New returns a new empty Merkle tree.
func New(hasher merkle.LogHasher) *Tree {
	return &Tree{hasher: hasher}
}

// AppendData adds the leaf hashes of the given entries to the end of the tree.
func (t *Tree) AppendData(entries ...[]byte) {
	for _, data := range entries {
		t.appendImpl(t.hasher.HashLeaf(data))
	}
}

// Append adds the given leaf hashes to the end of the tree.
func (t *Tree) Append(hashes ...[]byte) {
	for _, hash := range hashes {
		t.appendImpl(hash)
	}
}

func (t *Tree) appendImpl(hash []byte) {
	level := 0
	for ; (t.size>>level)&1 == 1; level++ {
		row := append(t.hashes[level], hash)
		hash = t.hasher.HashChildren(row[len(row)-2], hash)
		t.hashes[level] = row
	}
	if level > len(t.hashes) {
		panic("gap in tree appends")
	} else if level == len(t.hashes) {
		t.hashes = append(t.hashes, nil)
	}

	t.hashes[level] = append(t.hashes[level], hash)
	t.size++
}

// Size returns the current number of leaves in the tree.
func (t *Tree) Size() uint64 {
	return t.size
}

// LeafHash returns the leaf hash at the given index.
// Requires 0 <= index < Size(), otherwise panics.
func (t *Tree) LeafHash(index uint64) []byte {
	return t.hashes[0][index]
}

// TreeHash returns the current root hash of the tree.
func (t *Tree) TreeHash() []byte {
	return t.HashAt(t.size)
}

// HashAt returns the root hash at the given size.
// Requires 0 <= size <= Size(), otherwise panics.
func (t *Tree) HashAt(size uint64) []byte {
	if size == 0 {
		return t.hasher.EmptyRoot()
	}
	hashes := t.getNodes(compact.RangeNodes(0, size, nil))

	hash := hashes[len(hashes)-1]
	for i := len(hashes) - 2; i >= 0; i-- {
		hash = t.hasher.HashChildren(hashes[i], hash)
	}
	return hash
}

// InclusionProof returns the inclusion proof for the given leaf index in the
// tree of the given size. Requires 0 <= index < size <= Size(), otherwise may
// panic.
func (t *Tree) InclusionProof(index, size uint64) ([][]byte, error) {
	nodes, err := proof.inclusion(index, size)

	// fmt.Println(nodes)
	if err != nil {
		return nil, err
	}
	return nodes.rehash(t.getNodes(nodes.IDs), t.hasher.HashChildren)
}

// ConsistencyProof returns the consistency proof between the two given tree
// sizes. Requires 0 <= size1 <= size2 <= Size(), otherwise may panic.
func (t *Tree) ConsistencyProof(size1, size2 uint64) ([][]byte, error) {
	nodes, err := proof.consistency(size1, size2)

	if err != nil {
		return nil, err
	}
	hashes := t.getNodes(nodes.IDs)
	return nodes.rehash(hashes, t.hasher.HashChildren)
}

func (t *Tree) getNodes(ids []compact.NodeID) [][]byte {
	hashes := make([][]byte, len(ids))
	for i, id := range ids {
		hashes[i] = t.hashes[id.Level][id.Index]
	}
	return hashes
}

func newTree(entries [][]byte) *Tree {
	tree := New(rfc6962.DefaultHasher)
	tree.AppendData(entries...)
	return tree
}

func TestHashChildren(t *testing.T) {
	th := rfc6962.DefaultHasher
	empty_root := th.EmptyRoot()
	emptyLeaf := th.HashLeaf([]byte{})
	intermediateHash := th.HashChildren([]byte("N123"), []byte("N456")) // fake intermediaries
	// echo -n | sha256sum
	if hex.EncodeToString(empty_root) != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" {
		panic("RFC6962 Empty")
	}
	// echo -n 00 | xxd -r -p | sha256sum
	if hex.EncodeToString(emptyLeaf) != "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d" {
		panic("RFC6962 Empty Leaf")
	}
	// echo -n 014E3132334E343536 | xxd -r -p | sha256sum
	// 4E3132334E343536 -> N123N456
	if hex.EncodeToString(intermediateHash) != "aa217fe888e47007fa15edab33c2b492a722cb106c64667fc2b044444de66bbb" {
		panic("RFC6962 Node")
	}
}

func TestInclusion(t *testing.T) {

	th := rfc6962.DefaultHasher

	entries := [][]byte{}
	tree := newTree(entries)
	tree.appendImpl(th.HashLeaf([]byte("L123456")))
	// echo -n 004C313233343536 | xxd -r -p | sha256sum
	// 4C313233343536 -> L123456
	if hex.EncodeToString(tree.TreeHash()) != "395aa064aa4c29f7010acfe3f25db9485bbd4b91897b6ad7ad547639252b4d56" {
		t.Error("expected root to match leaf for tree of size 1")
	}
	tree.appendImpl(th.HashLeaf([]byte("L789")))

	// calculate leaf hash for f1
	// printf "\x00" | cat -  ./f1.txt | sha256sum

	// calculate leaf hash for f2
	// printf "\x00" | cat -  ./f2.txt | sha256sum

	// calculate root for 2 files in bash
	// echo -n 01"$(printf "\x00" | cat -  ./f1.txt | sha256sum)$(printf "\x00" | cat -  ./f2.txt | sha256sum)" | xxd -r -p | sha256sum
	if hex.EncodeToString(tree.TreeHash()) != "1798faa3eb85affab608a28cf885a24a13af4ec794fe3abec046f21b7a799bec" {
		t.Error("unexpected root for tree of size 2")
	}
	p1, _ := tree.InclusionProof(0, 2)
	// fmt.Println(hex.EncodeToString(p1[0]))
	// 12250d7a57ba6166c61b0b135fc2c21f096f918b69a42d673d812798d9c5d693
	err := proof.verify_inclusion(th, 0, 2, th.HashLeaf([]byte("L123456")), p1, tree.HashAt(2))
	if err != nil {
		t.Error(err)
	}
	// add 3rd entry
	tree.appendImpl(th.HashLeaf([]byte("L012")))
	if hex.EncodeToString(tree.TreeHash()) != "3322c85256086aa0e1984dff85eab5f1e11d4b8fbbd6c4510611e3bbab0e132a" {
		t.Error("unexpected root for tree of size 3")
	}
	p2, _ := tree.ConsistencyProof(2, 3)
	// fmt.Println(hex.EncodeToString(p2[0]))
	err = proof.verify_consistency(tree.hasher, 2, 3, p2, tree.HashAt(2), tree.HashAt(3))
	if err != nil {
		t.Error(err)
	}

	// echo -n 01"$(printf "\x00" | cat -  ./f1.txt | sha256sum)$(printf "\x00" | cat -  ./f2.txt | sha256sum)" | xxd -r -p | sha256sum
	// 1798faa3eb85affab608a28cf885a24a13af4ec794fe3abec046f21b7a799bec
	// echo -n 01"$(echo -n 01"$(printf "\x00" | cat -  ./f1.txt | sha256sum)$(printf "\x00" | cat -  ./f2.txt | sha256sum)" | xxd -r -p | sha256sum)$(printf "\x00" | cat -  ./f3.txt | sha256sum)"| xxd -r -p | sha256sum
	// 3322c85256086aa0e1984dff85eab5f1e11d4b8fbbd6c4510611e3bbab0e132a

}

type ReceiptTestCase struct {
	Leaf  uint64   `json:"leaf"`
	Size  uint64   `json:"size"`
	Root  []byte   `json:"root"`
	Proof [][]byte `json:"proof"`
}

func TestSbom(t *testing.T) {
	th := rfc6962.DefaultHasher
	entries := [][]byte{}
	tree := newTree(entries)
	fileToCheckIndex := uint64(0)
	filepath.Walk("./test-package",
		func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() {
				fileData, err := os.ReadFile(path)
				if err != nil {
					log.Println(err)
				}
				fileHash := th.HashLeaf(fileData)
				tree.appendImpl(fileHash)
				if path == "test-package/node_modules/jose/dist/browser/key/generate_secret.js" {
					// fmt.Println("tree size at ", tree.Size())
					// tree size at 30
					fileToCheckIndex = tree.Size() - 1
				}
			}
			return nil
		})

	fileToCheck, err := os.ReadFile("./test-package/node_modules/jose/dist/browser/key/generate_secret.js")
	if err != nil {
		t.Error(err)
	}
	index1 := fileToCheckIndex
	hash1 := th.HashLeaf(fileToCheck)
	if hex.EncodeToString(hash1) != "741fe362e81bc7db27210ac4caa91e7afec412fac206ecf735488cce475b1c78" {
		t.Error("file hash has changed")
	}
	root1 := tree.TreeHash()
	size1 := tree.Size()
	proof1, _ := tree.InclusionProof(fileToCheckIndex, size1)
	inclusionProofError := proof.verify_inclusion(th, index1, size1, hash1, proof1, root1)
	if inclusionProofError != nil {
		t.Error(inclusionProofError)
	}
	example := &ReceiptTestCase{Leaf: fileToCheckIndex, Size: size1, Root: root1, Proof: proof1}
	b, err := json.Marshal(example)
	if err != nil {
		t.Error(err)
	}
	fo, err := os.Create("receipt.json")
	if err != nil {
		t.Error(err)
	}
	fo.Write(b)

}
