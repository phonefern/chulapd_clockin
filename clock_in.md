# แนวคิดระบบ Clock-in สำหรับศูนย์พาร์กินสัน

## 1. ที่มาและปัญหาปัจจุบัน

ปัจจุบันการลงเวลาทำงานของเจ้าหน้าที่ภายในศูนย์พาร์กินสันใช้การลงชื่อและเวลาในเอกสารกระดาษ ซึ่งเอกสารถูกเก็บไว้อีกห้องหนึ่ง ทำให้ในบางครั้งเจ้าหน้าที่ลืมลงเวลา หรือจำเป็นต้องกลับมาเซ็นย้อนหลังภายหลัง เมื่อเวลาผ่านไปหลายวันอาจเกิดความไม่สะดวกในการตรวจสอบหรือสรุปข้อมูลเวลาทำงาน

แม้ว่าปัจจุบันการลงเวลาจะไม่ได้มีวัตถุประสงค์เพื่อควบคุมเวลาอย่างเคร่งครัด แต่สามารถพัฒนาให้เป็นระบบดิจิทัลขนาดเล็กที่ช่วยลดขั้นตอน เพิ่มความสะดวก และสามารถเรียกดูหรือส่งออกข้อมูลย้อนหลังได้เมื่อจำเป็น

แนวคิดหลักจึงเป็นการพัฒนา **Clock-in System สำหรับบุคลากรภายในศูนย์พาร์กินสัน** โดยให้เจ้าหน้าที่สามารถลงเวลาเข้าและออกงานผ่านโทรศัพท์มือถือเมื่ออยู่ภายในพื้นที่ทำงาน และให้ผู้ดูแลสามารถตรวจสอบ สรุป และ Export ข้อมูลเพื่อใช้ประกอบการรับรองเวลาทำงานได้

---

## 2. เป้าหมายของระบบ

- ลดการพึ่งพาการลงเวลาในกระดาษ
- ทำให้เจ้าหน้าที่สามารถ Clock in / Clock out ได้สะดวกจากโทรศัพท์มือถือ
- ตรวจสอบว่าผู้ใช้อยู่ในพื้นที่ทำงานในขณะลงเวลา
- เก็บประวัติการเข้า–ออกงานอย่างเป็นระบบ
- รองรับกรณีลืมลงเวลาและการขอแก้ไขข้อมูลย้อนหลัง
- มี Audit log สำหรับตรวจสอบการแก้ไขข้อมูล
- ผู้ดูแลสามารถดูข้อมูลของเจ้าหน้าที่ทุกคนได้
- สามารถ Export ข้อมูลเป็น Excel หรือ PDF
- สามารถพิมพ์เอกสารเพื่อให้หัวหน้าหรือผู้มีอำนาจลงนามรับรองได้
- รองรับการขยายระบบในอนาคตโดยไม่ต้องออกแบบใหม่ทั้งหมด

---

## 3. รูปแบบระบบที่เสนอ

ระบบแบ่งออกเป็น 3 ส่วนหลัก

### 3.1 LINE Official Account สำหรับเจ้าหน้าที่

ใช้ LINE Official Account เป็นช่องทางหลักสำหรับเจ้าหน้าที่ เนื่องจากไม่จำเป็นต้องติดตั้งแอปใหม่ และสามารถเข้าใช้งานได้จาก LINE ที่ใช้อยู่แล้ว

เจ้าหน้าที่สามารถเข้าถึงเมนู เช่น

- Clock in
- Clock out
- ประวัติการลงเวลาของฉัน
- ขอแก้ไขเวลา
- ดูสถานะคำขอแก้ไข

Rich Menu ของ LINE OA จะเชื่อมไปยัง LIFF Web App

---

### 3.2 LIFF Web App

LIFF เป็น Web App ที่เปิดภายใน LINE ใช้เป็นหน้าจอหลักสำหรับการ Clock in / Clock out

หน้าที่หลักของ LIFF ได้แก่

- ระบุตัวตนผู้ใช้งานจาก LINE
- แสดงสถานะการทำงานของวันปัจจุบัน
- ขอพิกัด Location จากโทรศัพท์
- ตรวจสอบว่าผู้ใช้อยู่ภายในพื้นที่ที่อนุญาต
- บันทึกเวลา Clock in
- บันทึกเวลา Clock out
- แสดงประวัติของผู้ใช้งาน
- ส่งคำขอแก้ไขเวลาย้อนหลัง

ตัวอย่างหน้าจอ

```text
19 สิงหาคม 2569

สถานะ: ยังไม่ได้ลงเวลา

พื้นที่
✓ Parkinson Center

[ Clock in ]
หลัง Clock in
Clocked in
08:27 น.

เวลาทำงานวันนี้
05:21:16

[ Clock out ]
3.3 Web Admin Dashboard
ส่วนผู้ดูแลระบบควรแยกออกจาก LINE และใช้งานผ่าน Web Dashboard บนคอมพิวเตอร์
ผู้ดูแลสามารถ
- ดูข้อมูลการลงเวลาของเจ้าหน้าที่ทุกคน
- Filter ตามวัน เดือน บุคคล หรือสถานะ
- ตรวจสอบ Clock in / Clock out
- ตรวจสอบรายการที่ยังไม่ได้ Clock out
- ดูคำขอแก้ไขเวลา
- Approve / Reject คำขอแก้ไข
- ดู Audit log
- Export Excel
- Export PDF
- Print รายงานสำหรับลงนามรับรอง
ตัวอย่างตาราง
ชื่อ	วันที่	เข้า	ออก	ชั่วโมง	สถานะ
เจ้าหน้าที่ A	19/08/2569	08:27	16:35	8:08	ปกติ
เจ้าหน้าที่ B	19/08/2569	08:35	16:31	7:56	ปกติ
เจ้าหน้าที่ C	19/08/2569	09:04	-	-	ยังไม่ Clock out


4. User Flow หลัก
Clock in
เปิด LINE
    ↓
เข้า LINE OA
    ↓
กด Clock in จาก Rich Menu
    ↓
เปิด LIFF
    ↓
ตรวจสอบ LINE User
    ↓
ขอ Location
    ↓
ตรวจสอบว่าอยู่ในพื้นที่ที่กำหนด
    ↓
อยู่ในพื้นที่?
  ┌───────┴───────┐
  │               │
 Yes              No
  │               │
  ↓               ↓
บันทึกเวลา      ไม่อนุญาตให้ Clock in
  ↓
แสดงสถานะ Clocked in
Clock out
เปิด LINE OA
    ↓
Clock out
    ↓
ตรวจ Location
    ↓
บันทึกเวลาออก
    ↓
คำนวณเวลาทำงาน
    ↓
แสดงสรุปเวลาของวัน
5. ระบบตรวจสอบพื้นที่ทำงาน
ระบบใช้แนวคิด Geofence
กำหนดตำแหน่งของศูนย์เป็น Center Point และกำหนดรัศมีที่อนุญาต เช่นประมาณ 100–200 เมตร โดยค่าจริงควรทดสอบจากพื้นที่ใช้งานจริงก่อนกำหนด
ข้อมูลที่อาจเก็บขณะ Clock in / Clock out
- Latitude
- Longitude
- Location accuracy
- Timestamp
- ระยะห่างจากตำแหน่งศูนย์
ระบบไม่จำเป็นต้องติดตาม GPS ของเจ้าหน้าที่ตลอดเวลา
ควรขอ Location เฉพาะในขณะ
- Clock in
- Clock out
เท่านั้น เพื่อให้ระบบเรียบง่ายและลดการเก็บข้อมูลที่ไม่จำเป็น
เนื่องจากภายในอาคารโรงพยาบาล GPS อาจมีความคลาดเคลื่อน จึงไม่ควรกำหนดรัศมีแคบเกินไป เช่น 10–20 เมตร
หากในอนาคตพบว่า GPS ไม่เสถียร สามารถเพิ่มวิธีตรวจสอบอื่น เช่น
- QR Code ประจำศูนย์
- NFC Tag
- Wi-Fi verification
โดยไม่จำเป็นต้องเปลี่ยนโครงสร้างหลักของระบบ
6. การจัดการกรณีลืมลงเวลา
ระบบควรรองรับกรณีลืม Clock in หรือ Clock out ตั้งแต่ Version แรก
ตัวอย่าง
18 สิงหาคม 2569

Clock in : 08:31
Clock out: ไม่มีข้อมูล

[ ขอแก้ไขเวลา ]
ผู้ใช้ระบุ
ประเภท: Clock out
เวลาที่ขอแก้ไข: 16:32

เหตุผล:
ลืม Clock out

[ ส่งคำขอ ]
คำขอจะถูกส่งไปยัง Admin
Admin สามารถ
- Approve
- Reject
ได้
7. Audit Log
ข้อมูลการลงเวลาต้นฉบับไม่ควรถูกแก้ไขทับโดยไม่มีประวัติ
ตัวอย่าง
Original clock_out : NULL
Requested clock_out: 16:32
Reason             : ลืม Clock out
Requested by       : Employee A
Approved by        : Admin B
Approved at        : 19/08/2569 10:15
Audit log ช่วยให้สามารถตรวจสอบย้อนหลังได้ว่า
- ใครเป็นผู้แก้ไข
- แก้ไขข้อมูลอะไร
- ค่าเดิมคืออะไร
- ค่าใหม่คืออะไร
- เหตุผลคืออะไร
- ใครเป็นผู้อนุมัติ
- อนุมัติเมื่อใด
8. Notification ผ่าน LINE
ในอนาคตสามารถใช้ LINE OA เป็นช่องทางแจ้งเตือน เช่น
ลืม Clock out
วันนี้คุณ Clock in เวลา 08:32 น.
แต่ยังไม่ได้ Clock out
ผลคำขอแก้ไข
คำขอแก้ไขเวลาวันที่ 18 สิงหาคม 2569
ได้รับการอนุมัติแล้ว
Reminder
อาจเพิ่มการแจ้งเตือนช่วงเย็นเฉพาะผู้ที่ Clock in แล้วแต่ยังไม่ได้ Clock out
9. Architecture เบื้องต้น
                  LINE Official Account
                           │
                    Rich Menu / Message
                           │
                           ▼
                       LIFF Web App
                  ┌────────┴────────┐
                  │                 │
            LINE Identity      Geolocation
                  │                 │
                  └────────┬────────┘
                           ▼
                       Backend API
                           │
                           ▼
                        Database
                     เช่น Supabase
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
          Attendance                Audit Log
              │
              ▼
       Web Admin Dashboard
              │
        ┌─────┴─────┐
        ▼           ▼
      Excel        PDF / Print
10. Database Schema เบื้องต้น
employees
ใช้เก็บข้อมูลผู้ใช้งาน
id
employee_code
name
line_user_id
role
active
created_at
updated_at
attendance
ใช้เก็บข้อมูลการลงเวลา
id
employee_id
work_date

clock_in_at
clock_out_at

clock_in_lat
clock_in_lng
clock_in_accuracy

clock_out_lat
clock_out_lng
clock_out_accuracy

total_minutes
status

created_at
updated_at
attendance_adjustments
ใช้เก็บคำขอแก้ไขเวลา
id
attendance_id
employee_id

adjustment_type
original_value
requested_value
reason

status

approved_by
approved_at

created_at
ตัวอย่าง status
pending
approved
rejected
work_locations
ใช้กำหนดพื้นที่ที่อนุญาตให้ Clock in / Clock out
id
name
latitude
longitude
allowed_radius_meters
active
audit_logs
ใช้เก็บประวัติการเปลี่ยนแปลงข้อมูลสำคัญ
id
user_id
action
entity_type
entity_id
old_value
new_value
created_at
11. Scope สำหรับ MVP Version 1
Employee
- เข้าใช้งานผ่าน LINE OA
- ระบุตัวตนผ่าน LINE
- Clock in
- Clock out
- ตรวจสอบ Location
- ดูสถานะการทำงานของวันนี้
- ดูประวัติการลงเวลาของตนเอง
- ขอแก้ไขเวลา
- ดูสถานะคำขอแก้ไข
Admin
- Login เข้า Admin Dashboard
- ดู Attendance ของเจ้าหน้าที่
- Filter ตามช่วงเวลา
- ดูรายละเอียดแต่ละคน
- ตรวจสอบ Missing Clock out
- Approve / Reject คำขอแก้ไข
- ดู Audit log
- Export Excel
- Export PDF
- Print รายงาน
System
- Timestamp
- Geofence
- Location accuracy
- LINE user mapping
- Attendance calculation
- Adjustment workflow
- Audit log
12. สิ่งที่ยังไม่จำเป็นสำหรับ Version 1
เพื่อลดความซับซ้อน ไม่ควรเริ่มจากระบบ HR เต็มรูปแบบ
สิ่งที่ยังไม่จำเป็น ได้แก่
- Face recognition
- Selfie ตอน Clock in
- Fingerprint
- GPS Tracking ตลอดทั้งวัน
- Payroll
- Salary calculation
- ระบบ OT แบบเต็มรูปแบบ
- ระบบประเมินพนักงาน
- Native Mobile Application
- ระบบ HR ขนาดใหญ่
แนวคิดของ Version 1 คือ
เปลี่ยนการลงเวลาในกระดาษให้เป็นระบบดิจิทัลที่สะดวก ตรวจสอบย้อนหลังได้ และ Export เพื่อรับรองได้เมื่อจำเป็น

13. แนวทางขยายในอนาคต
เมื่อ MVP ใช้งานได้แล้ว สามารถเพิ่ม Feature ได้ตามความต้องการจริง เช่น
Attendance
- Late / Early leave
- Working hours policy
- Flexible working hours
- OT
- Multiple shifts
Leave
- ลาป่วย
- ลากิจ
- ลาพักร้อน
- Work from home
- ปฏิบัติงานนอกสถานที่
Calendar
- วันหยุดราชการ
- วันหยุดของศูนย์
- ตารางเวร
- ตารางปฏิบัติงาน
Location
- รองรับหลายสถานที่
- QR Clock in
- NFC
- Wi-Fi verification
Reporting
- Monthly attendance summary
- Individual attendance report
- Work-hour summary
- Missing attendance report
- Signature / approval workflow
Notification
- Reminder ให้ Clock in
- Reminder ให้ Clock out
- แจ้งคำขอแก้ไข
- แจ้งผลอนุมัติ
14. Technology Stack ที่เหมาะกับ MVP
ตัวอย่าง Stack ที่สามารถใช้ได้
Frontend Employee
LINE OA + LIFF
Next.js / React

Frontend Admin
Next.js

Backend
Next.js API หรือ Supabase

Database
PostgreSQL / Supabase

Authentication
LINE Login สำหรับ Employee
Admin authentication สำหรับผู้ดูแล

Hosting
Vercel

Export
Excel / PDF
ไม่จำเป็นต้องยึด Stack นี้ทั้งหมด สามารถปรับตามความถนัดของผู้พัฒนาได้
15. หลักการสำคัญของระบบ
ระบบนี้ควรถูกออกแบบในฐานะ เครื่องมือเพิ่มความสะดวกในการลงเวลาทำงาน มากกว่าระบบติดตามหรือจับผิดพนักงาน
หลักการสำคัญคือ
- ใช้งานง่าย
- Clock in ได้ภายในไม่กี่วินาที
- ไม่เก็บ Location เกินความจำเป็น
- ผู้ใช้ตรวจสอบข้อมูลของตัวเองได้
- ข้อมูลที่แก้ไขย้อนหลังต้องตรวจสอบได้
- Admin สามารถสรุปผลได้ง่าย
- รองรับการพิมพ์และรับรองข้อมูลเมื่อต้องการ
16. สรุปแนวคิดระบบ
แนวทางที่เสนอคือ
Employee = LINE OA + LIFF
Admin = Web Dashboard
Backend / Database = ระบบกลางเดียวกัน
Flow หลักคือ
Employee
LINE OA
   ↓
LIFF
   ↓
Location Check
   ↓
Clock in / Clock out
   ↓
Database
   ↓
Attendance History
และฝั่งผู้ดูแล
Admin
   ↓
Web Dashboard
   ↓
Attendance Management
   ↓
Approve Adjustment
   ↓
Export Excel / PDF
   ↓
Print / Signature