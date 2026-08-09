# Orange Calendar Logo Design Spec

## Overview
Update the app's favicon and replace the letter "П" mark on the authentication card and navigation bar with an orange calendar logo matching the brand's primary terracotta color palette (`#B2622D`).

## Specification

### 1. Favicon Asset Update (`apps/web/public/favicon.svg`)
- Change the background rectangle fill from `#1E3A8A` (blue) to `#B2622D` (terracotta orange).
- Preserve the inner white calendar vector geometry (frame, binder loops, header divider, and date cell).

### 2. Reusable Component (`apps/web/src/components/CalendarLogo.tsx`)
- Implement a React SVG component `CalendarLogo` accepting optional `className` and `size` props.
- Output SVG with `viewBox="0 0 32 32"` matching `favicon.svg`.
- Set background fill to `#B2622D` and line/rect stroke/fill to `#F8FAFC`.

### 3. Page Integrations
- **`apps/web/src/features/auth/AuthCard.tsx`**: Replace the text node containing letter "П" with `<CalendarLogo />`.
- **`apps/web/src/components/NavBar.tsx`**: Add `<CalendarLogo className="size-7" />` to the brand link `<Link to="/">` next to "Переговорні".

## Verification & Testing
- Verify unit tests pass in `apps/web` (`npm run test -w apps/web`).
- Verify visual rendering across auth screens and main header.
