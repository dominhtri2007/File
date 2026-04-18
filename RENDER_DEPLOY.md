# Deploy tren Render

Du an nay duoc cau hinh de chay tren Render bang 1 Web Service:

- Express backend phuc vu API tai `/api`.
- Express backend cung phuc vu frontend da build tu `frontend/dist`.
- Render build frontend truoc, sau do start backend.

## 1. Day code len GitHub

Render can repo GitHub/GitLab/Bitbucket de auto deploy.

## 2. Tao service bang Blueprint

Trong Render Dashboard:

1. Chon `New` > `Blueprint`.
2. Chon repo nay.
3. Render se doc file `render.yaml`.
4. Dien cac bien moi truong bi danh dau `sync: false`.

## 3. Bien moi truong bat buoc

`render.yaml` da dat:

```env
DB_PROVIDER=firebase
EMAIL_CODE_TTL_MINUTES=10
ALLOW_DEV_EMAIL_CODE=false
```

Ban can dien 3 bien Firebase sau tren Render:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Khong dua file service account JSON len GitHub. Tren Render nen dung cac bien moi truong ben tren thay vi `FIREBASE_SERVICE_ACCOUNT_PATH`.

## 4. Email that khi dang ky / quen mat khau

Neu muon gui email that, dien them:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Steam Manager <your-email@gmail.com>"
```

Neu dung Gmail, `SMTP_PASS` phai la App Password.

## 5. Chay thu local giong Render

Tu thu muc goc:

```bash
npm run render-build
npm start
```

Sau do mo:

```text
http://localhost:3001
http://localhost:3001/api/health
```

## 6. Neu muon tach frontend/backend thanh 2 Render service

Frontend Static Site:

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment: `VITE_API_URL=https://your-backend-service.onrender.com/api`

Backend Web Service:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Neu tach rieng, co the dat `CORS_ORIGIN=https://your-frontend-service.onrender.com` cho backend.
