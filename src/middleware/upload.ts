import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary'; // Giả sử đã cấu hình như trước
import  HTTP_STATUS  from '../constants/httpStatus';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  console.log('File details:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });
  const allowedTypes = [
    'application/pdf', // PDF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Chấp nhận file
  } else {
    cb(new Error('Chỉ chấp nhận file PDF, Word (.doc, .docx), hoặc Excel (.xls, .xlsx)!')); // Từ chối file
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: fileFilter,
});

export const uploadFile = async (req: Request, res: Response) => {
  try {
   // console.log('Request headers:', req.headers);
   // console.log('Request body:', req.body);

    upload.single('file')(req, res, async (err: any) => {
     // console.log('Upload middleware error:', err);
    //  console.log('Request file:', req.file);

      if (err) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: err.message || 'Lỗi khi tải file lên!',
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Không tìm thấy file nào được tải lên!',
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // Upload file lên Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        folder: 'decisions/drafts',
      });

      // Xóa file tạm trên server
      fs.unlinkSync(req.file.path);

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Tải file thành công!',
        status: HTTP_STATUS.CREATED,
        data: { fileUrl: uploadResult.secure_url },
      });
    });
  } catch (error) {
    console.error('Lỗi trong uploadFile:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi hệ thống khi tải file!',
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    });
  }
};

export default upload;