# Luu database len Firebase

Backend da ho tro 2 che do database:

- `DB_PROVIDER=sqlite`: dung file `database.sqlite` nhu hien tai.
- `DB_PROVIDER=firebase`: dung Firebase Firestore qua Firebase Admin SDK.

## 1. Tao service account Firebase

1. Vao Firebase Console.
2. Chon project cua ban.
3. Vao `Project settings` > `Service accounts`.
4. Bam `Generate new private key`.
5. Luu file JSON vao thu muc `backend/`, vi du: `backend/firebase-service-account.json`.

File service account chua private key. Khong dua file nay len GitHub hay gui cho nguoi khac.

## 2. Tao file .env

Trong thu muc `backend/`, copy `.env.example` thanh `.env`, roi sua:

```env
DB_PROVIDER=firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
JWT_SECRET=doi_chuoi_nay_thanh_bi_mat_rieng
```

Neu muon quay lai SQLite, doi:

```env
DB_PROVIDER=sqlite
```

## 3. Chuyen du lieu SQLite hien co len Firebase

Chay lenh trong thu muc `backend/`:

```bash
npm run migrate:firebase
```

Script nay se copy cac bang hien co len Firestore:

- `users`
- `settings`
- `steam_accounts`
- `keys`
- `user_account_access`
- `orders`
- `services`

Script giu nguyen `id` de key, don hang va quyen truy cap khong bi lech.

## 4. Chay server

```bash
npm start
```

Hoac dung `start.bat` o thu muc goc nhu truoc.

## 5. Kiem tra

Mo:

```text
http://localhost:3001/api/settings
```

Neu server dang dung Firebase, log backend se co dong:

```text
Connected to Firebase Firestore.
```

## 6. Gui ma xac thuc email khi dang ky

Neu chua cau hinh SMTP, backend van cho test local: ma xac thuc se hien trong terminal backend va response API se co `dev_code`.

De gui email that, them cac bien sau vao `backend/.env`:

```env
APP_NAME=Steam Manager
EMAIL_CODE_TTL_MINUTES=10
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Steam Manager <your-email@gmail.com>"
```

Voi Gmail, `SMTP_PASS` nen la App Password, khong dung mat khau dang nhap Gmail chinh.
