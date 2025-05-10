#  Changelog

Tài liệu ghi lại các thay đổi quan trọng trong hệ thống quản lý đăng ký đề tài tốt nghiệp.

---

## [1.3.0] - 2025-05-10

### ✨ Added
- Added check to reject **inter-major groups** from registering **single-major topics**, and vice versa.
- Logged topic registration and deletion actions using **leader's or user's email** for traceability.

###  Fixed
- Prevented **non-inter-major groups** from registering **inter-major topics**.
- Prevented **inter-major groups** from registering **single-major topics**.
- Rejected mentor approval when the **leader's group is not found** or invalid.
- Stopped approval if the group does not meet **minimum/maximum member constraints**.
- Ensured mentor approval transaction is **rolled back** when group conditions fail.
- Improved **error handling and message clarity** for both registration and approval flows.
- Fixed system log error when calling `logSystemEvent` from within `TopicService`.
- Restricted **lecturers** to only delete topics they created; full deletion rights remain with **admins** and **academic officers**.

###  Security
- Added strict backend validations to prevent **invalid topic-group relationships** from being registered or approved.
- Validated topic deletion permissions to avoid unauthorized soft deletes.


