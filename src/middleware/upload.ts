import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(), // Lưu file vào bộ nhớ tạm thời
  limits: { fileSize: 10 * 1024 * 1024 }, // Giới hạn 10MB (tùy chỉnh nếu cần)
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});

export default upload;