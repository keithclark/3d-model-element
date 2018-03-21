
const getFileExtension = url => {
  let path = url.split(/[?#]/)[0];
  let segments = path.split('/');
  let filename = segments.pop();
  let ext = filename.split('.');
  if (ext.length > 0) {
    return '.' + ext.pop();
  }
}

export default {
  getFileExtension
}