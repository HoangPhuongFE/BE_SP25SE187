import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

export const uploadExcel = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Chỉ chấp nhận file Excel'));
    }
    cb(null, true);
  }
}).single('file'); 