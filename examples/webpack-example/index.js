
import * as transmute from '@transmute/rfc9162'

const test = () => {
  console.log(transmute);
  console.log('test complete.');
}
// setup exports on window
window.test = {
  test
}
