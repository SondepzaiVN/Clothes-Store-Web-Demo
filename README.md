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
| Development and build | Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Code quality | ESLint |

## Requirements

- Node.js 20 or later
- npm 10 or later

## Installation

Clone or extract the project, open a terminal in this directory, and run:

```bash
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

Registration data, cart contents, conversations, and orders are stored only in the application's in-memory state and are reset when the browser page is reloaded.

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run preview` | Preview the generated production build. |
| `npm run lint` | Check the source code with ESLint. |

## Project Structure

```text
web-ban-quan-ao/
├── public/
│   ├── images/                 # Local product images
│   └── favicon.svg             # DECO browser icon
├── src/
│   ├── components/
│   │   ├── auth/               # Login, registration, and OTP modal
│   │   ├── layout/             # Header and mobile navigation
│   │   └── products/           # Product card, rating, and category UI
│   ├── data/
│   │   └── mockData.ts         # Products, vouchers, and initial demo data
│   ├── styles/                 # Tailwind and theme styles
│   ├── types/
│   │   └── index.ts            # Shared TypeScript models
│   ├── utils/
│   │   └── format.ts           # Currency and search-text helpers
│   ├── App.tsx                 # Application state and main feature flows
│   └── main.tsx                # React entry point
├── package.json
└── vite.config.ts
```

## Verification

Before submitting or deploying the project, run:

```bash
npm run lint
npm run build
```

Both commands should finish without errors.

## Prototype Limitations

- No backend server or persistent database is connected.
- OTP delivery is simulated; no real email is sent.
- Bank and e-wallet payments do not contact a real payment gateway.
- Delivery updates and customer-support replies are simulated.
- Product images and product records are local demonstration data.

These limitations are deliberate: this repository provides the user-interface prototype used to demonstrate the software requirements and design documented in the DECO course report.
