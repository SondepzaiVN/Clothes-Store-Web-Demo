# DECO – Online Fashion Shopping Platform

DECO is a responsive web application developed for the **Introduction to Software Engineering** course. It demonstrates the primary shopping flow of an online fashion platform, from product discovery to order tracking and customer support.

The current version is a front-end prototype. Its interface is presented in Vietnamese, while the source structure and project documentation follow standard English naming conventions.

## Live Demo

The deployed DECO prototype is available at:

**[https://shop.dangson.id.vn/](https://shop.dangson.id.vn/)**

## Main Features

- Browse fashion products by category.
- Search products by name or description.
- View product details, available sizes, colors, prices, and ratings.
- Add product variants to the shopping cart.
- Select cart items and update their quantities.
- Register and log in with email/password and OTP verification.
- Confirm delivery information and apply the best available voucher.
- Select COD, bank transfer, or e-wallet payment.
- Place and track orders.
- Send messages to the DECO customer-support administrator.

Seller-facing functions are intentionally excluded because Seller is not an actor in the current project scope. Product and shop information is assumed to be maintained by the system administrator.

## Technology Stack

| Area | Technology |
|---|---|
| User interface | React 18, TypeScript |
| Backend API | Node.js, Express |
| Database | Microsoft SQL Server, stored procedures and transactions |
| Semantic search | Multilingual MiniLM, SQL Server `VECTOR(384)` |
| Development and build | Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Code quality | ESLint |

## Requirements

- Node.js 20 or later
- npm 10 or later
- Python 3.10 or later for local semantic search

## Installation

Clone or extract the project, then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite will display the local development address, normally:

```text
http://localhost:5173
```

## Demo Authentication

The prototype uses simulated authentication so that the complete interface flow can be demonstrated without a backend service.

- Enter any correctly formatted email address.
- Enter a password containing at least six characters.
- Use the following OTP when requested:

```text
123456
```

For an account preloaded with orders, payment states, a saved address, and a support conversation, use:

```text
Email: demo@deco.vn
Password: Demo@123
OTP: 123456
```

Admin đăng nhập bằng cùng giao diện với khách hàng. Sau khi xác nhận OTP, tài
khoản có vai trò `ADMIN` được chuyển tới `/admin`:

```text
Email: admin@deco.vn
Password: Admin@123
OTP: 123456
```

Registration data, cart contents, conversations, and orders are stored only in the application's in-memory state and are reset when the browser page is reloaded.

The repository contains a SQL Server backend in `backend/`. Set the values from
`backend/.env.example`, start the backend, and set
`VITE_USE_DATABASE_API=true` in the frontend environment to run the catalog,
order, payment and administration flows against the local `DECO` database.

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run preview` | Preview the generated production build. |
| `npm run lint` | Check the source code with ESLint. |

Backend commands:

```bash
cd backend
npm install
npm test
npm start
```

AI search runs locally in a separate lightweight process:

```powershell
cd ai-service
python -m venv --system-site-packages .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

After running `database/deploy/12_ai_search.sql`, index the current products:

```powershell
cd backend
npm run ai:reindex
```

Database scripts and their required execution order are documented in
[`database/README.md`](database/README.md).

## Project Structure

```text
Clothes-Store-Web-Demo/
├── frontend/                   # React + Vite customer/admin interface
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/                    # Node.js + Express API
│   ├── src/
│   ├── test/
│   └── package.json
├── ai-service/                 # Local multilingual embedding model
├── database/                   # deploy, seeds, tests và schema.dbml
├── README.md
└── vercel.json
```

## Verification

Before submitting or deploying the project, run:

```bash
cd frontend
npm run lint
npm run build
```

Both commands should finish without errors.

## Prototype Limitations

- Authentication is simulated in the frontend; there is no production JWT/session validation.
- The SQL Server backend is intended to run locally for the course demonstration.
- OTP delivery is simulated; no real email is sent.
- Bank and e-wallet payments do not contact a real payment gateway.
- Delivery updates and customer-support replies are simulated.
- Product images and product records are local demonstration data.

These limitations are deliberate: this repository provides the user-interface prototype used to demonstrate the software requirements and design documented in the DECO course report.
