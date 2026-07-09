# TASK: ADMIN SCHEDULING + PRICE SYNCHRONIZATION + TESTIMONIAL MODULE

## OBJECTIVE

Implement the following features without breaking existing functionality. Perform a complete dependency analysis before modifying the codebase. Maintain backward compatibility and preserve the current UI/UX.

---

## TASK 1 — CONVERT ENTIRE SCHEDULING SYSTEM TO 24-HOUR FORMAT

### ADMIN PANEL

Replace every 12-hour (AM/PM) time picker with a 24-hour time format.

Requirements:

* Remove all AM/PM logic.
* Store times using HH:mm.
* Display all times as HH:mm.
* Examples:

  * 08:00
  * 09:30
  * 13:00
  * 18:30
  * 21:45

Any scheduling conflict caused by AM/PM formatting must be eliminated.

---

### CLIENT SIDE

The booking page must display exactly the same time slots configured by the administrator.

Admin:

08:00

09:00

13:30

18:00

↓

Client:

08:00

09:00

13:30

18:00

No conversion to AM/PM is permitted anywhere in the application.

---

## TASK 2 — REAL-TIME PRICE SYNCHRONIZATION

Current issue:

Service prices displayed to clients are not synchronized with the values configured inside the Admin → Tarifs module.

Implement a single source of truth.

Admin → Tarifs

↓

Database

↓

Client Interface

↓

Booking

↓

Checkout

↓

Invoice

↓

Payment Confirmation

↓

Dashboard

Every displayed price must originate from the Admin Tarifs configuration.

Services concerned:

* Soin énergétique
* Soin direct
* Accompagnement 1:1

Hardcoded prices must be completely removed.

Any modification made by the administrator must instantly propagate throughout the application without requiring additional manual changes.

---

## TASK 3 — TESTIMONIAL SYSTEM

Create a complete testimonial management system.

### HOME PAGE

Create a hidden navigation trigger integrated inside the crown element of the homepage hero section.

Clicking this hidden element opens:

Testimonials Section

The button must preserve the current visual design.

---

### CLIENT FEATURES

Only authenticated users may submit testimonials.

Each testimonial contains:

* Client Name
* Service Received
* Date
* Review Text
* Rating (1–5 Stars)

Create:

TextArea

Star Rating Component

Submit Button

---

### MODERATION

Every submitted testimonial must default to:

status = PENDING

Never publish automatically.

---

### ADMIN PANEL

Create a new navigation item:

Testimonials

Administrator capabilities:

* View all testimonials
* Read full content
* View associated client
* View service
* View rating
* Approve
* Reject
* Edit
* Delete

Workflow:

Pending

↓

Approved

↓

Visible on Website

Rejected testimonials remain hidden.

---

### PUBLIC DISPLAY

Display approved testimonials only.

Each testimonial card includes:

★★★★★

Client Name

Service Received

Date

Review

Use responsive cards with smooth animations.

---

## SECURITY

* Authenticated users only.
* One user may edit only their own pending testimonials.
* Admin has full CRUD permissions.
* Sanitize all inputs.
* Prevent HTML injection.
* Prevent JavaScript injection.
* Validate all server-side requests.
* Enforce role-based authorization.

---

## RESPONSIVE DESIGN

Validate compatibility with:

* Desktop
* Tablet
* Android
* iPhone

Maintain identical functionality across all devices.

---

## REGRESSION TESTING

Before deployment execute a full regression audit.

Verify:

✓ All scheduling uses 24-hour format.

✓ No AM/PM logic remains.

✓ Admin scheduling synchronizes correctly with client booking.

✓ Tarifs module is the only pricing source.

✓ Booking displays synchronized prices.

✓ Checkout displays synchronized prices.

✓ Invoice displays synchronized prices.

✓ Payment confirmation displays synchronized prices.

✓ Dashboard displays synchronized prices.

✓ Testimonial workflow operates correctly.

✓ Pending approval workflow functions.

✓ Administrator moderation functions.

✓ Responsive layout preserved.

✓ No existing functionality has been broken.

Do not introduce regressions. Preserve all existing business logic while implementing these features.
