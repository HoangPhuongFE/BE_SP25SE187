Cài đặt  npm i nếu ko đc cài mpn i 
Khởi chạy code B1: npm run build -> B2:npm run dev

Functional requirements
1.	Academic Officer
- Import students who undertake the graduation thesis by major. The student list is retrieved from the FAP system.
- View the list of students who have groups or have not yet formed groups. The system can send emails to students regarding group formation. Depending on the situation, group formation can last until the Block 3W exam results of the previous semester are released. Students must be checked for eligibility to undertake graduation projects. A group may include students from different majors(for multi-major projects).
- With  students without groups, he/she can use the function “create automatically group” from the system. 
- Statistics on the list of registered groups/topics.
- Create the topic assignment decision form draft(quyết định về việc giao hướng dẫn khóa luận tốt nghiệp-bản nháp) (around week 2). The system should support AI tools to verify topic codes, topic names, and group codes against the registered list(optional). After approval, Academic officer will upload the decision to the system, and emails will be sent to the Examination Officer , project managers, mentors, and relevant students.
- Download weekly progress report.
- View mentors’ meeting schedules.
- Statistics for review sessions (review 1, 2, 3) and send email notifications to relevant parties.
2.	Graduation Thesis Manager
- Send email notifications to lecturers about accepting topics (Rounds 1, 2, 3), including the registration template form format.
- Import topics from businesses(if have).
- Create a list of the review council members and record results. Publish the list of approved topics. The system will send email to relative parties.
- Assign lecturers for review 1, 2, and 3 reviews
- Assign lectures for defense 1st and 2nd.
- Statistics/reports.
- View group/topic feedback.
- He/she can use AI tools to alert the manager about duplicate topic names(optional).
3.	Examination Officer
- View the topic assignment decision form.  He/she can use AI tools to verify group codes, topic codes, and topic names in the assignment decision against the system's records. If discrepancies are found, Examination Officer can request corrections by the Academic officer.
- View the list of students/lecturers involved in the project. Note: The screen should display the group's general information and detailed information about each student’s major.
-View the list of groups/students scheduled for defense by round.
- View the list of proposed/official councils.
- Create the council establishment decision form, upload it to the system after approval.
- Support features for statistics/reports and printing lists.
4.	Mentors
- Upload/download topic registration forms. The form may include a group of students or no students.
- View the list of topics with filter options for customized display.
- Register to become co-mentor topics.
- View/download  the list of approved topics.
- Register a student group/topic.
- Schedule meeting times.
- View/update progress information of the project. Record outcomes after meeting with student groups.
- Upload/download final feedback files (.cmt), which file take from the FPT university's grading software.
- Confirm groups/topics for defense in Round 1, Round 2, or rework topic.
5.	Student Groups/Students
- View the list of students with or without groups.
- Can contact each other to form groups (e.g., chat).
- View the list of topics with filter options for customized display.
- Register groups/topics.
- View group/member information. Change roles within the group (team leader, member) before the registration phase closes.
- View the meeting schedule with mentors.
- View/update progress reports.
- View the list of groups/topics under review (Round 1, 2, 3).
- View the list of groups/topics for defense in Round 1 and Round 2.
-  Feedback after each meeting or after completing the project
6.	Admin
- Manage user accounts.
- Configure system parameters for operational settings.
	System functions:
-  With  students without groups, the system will support to create automatically  groups.
- Using AI Tools to verify topic code, topic title, group code in the system with the decision form, check duplicate topics (optional)
- Using AI tools to check duplicate topic(optional)
- Send email

