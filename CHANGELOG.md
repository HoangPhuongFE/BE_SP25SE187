# 📦 Changelog

Tài liệu ghi lại các thay đổi quan trọng trong hệ thống quản lý đăng ký đề tài tốt nghiệp.

---

## [Unreleased]

### 🐞 Fixed
- Prevented **non-inter-major groups** from registering **inter-major topics**.
- Rejected mentor approval when the **leader's group is not found** or invalid.
- Stopped approval if the group does not meet **minimum/maximum member constraints**.
- Ensured mentor approval transaction is **rolled back** when group conditions fail.
- Improved **error handling and message clarity** for both registration and approval flows.

### 🔒 Security
- Added strict backend validations to prevent **invalid topic-group relationships** from being approved.

---


