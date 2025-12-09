# CLAUDE.md - AI Assistant Guide

## Project Overview

This repository contains a single-page wedding website for **Raquel & Adrián's wedding** (October 11, 2026, in Ávila, Spain). The site is built as a static HTML website with embedded CSS and JavaScript, designed to provide guests with all wedding information and interactive features.

**Repository:** `boda.raquelyadrian.com`
**Language:** Spanish (es)
**Type:** Static website (no build process required)

## Codebase Structure

```
boda.raquelyadrian.com/
├── .git/                 # Git repository data
├── index.html            # Main website file (complete single-page application)
├── README.md             # Basic repository description
└── CLAUDE.md             # This file - AI assistant guide
```

### Key Characteristics

- **Single-file architecture**: Everything (HTML, CSS, JavaScript) is contained in `index.html`
- **No dependencies**: No package.json, no node_modules, no build tools
- **Self-contained**: All styles and scripts are inline (no external CSS/JS files)
- **CDN resources**: Uses external CDNs for fonts and icons

## Technology Stack

### Core Technologies
- **HTML5**: Semantic markup with modern features
- **CSS3**: Inline styles with CSS custom properties (CSS variables)
- **Vanilla JavaScript**: No frameworks or libraries

### External Resources (CDNs)
- **Google Fonts**:
  - Cormorant Garamond (serif, decorative)
  - Montserrat (sans-serif, body text)
- **Font Awesome 6.4.0**: Icon library
- **Embedded content**:
  - Google Maps iframes for locations
  - Spotify embed for wedding playlist

### Design System

**CSS Variables** (defined in `:root`):
```css
--primary-cream: #faf8f5    /* Background color */
--accent-sage: #9aad96      /* Accent green */
--deep-forest: #2c3e2d      /* Dark green */
--rose-gold: #d4a574        /* Rose gold accent */
--soft-blush: #f4e6e1       /* Light pink */
--text-dark: #2a2a2a        /* Main text color */
--text-light: #666          /* Secondary text color */
```

## Website Sections

The website is organized into the following sections (accessible via navigation):

1. **Hero (#home)**: Landing section with countdown timer and Santa Teresa de Jesús quote
2. **Our Story (#story)**: Couple's story with text and image placeholder
3. **Gallery (#gallery)**: Photo gallery grid with placeholders
4. **Padrinos (#padrinos)**: Godparents and witnesses section
5. **Locations (#locations)**: Ceremony (Cathedral) and reception (Dehesa del Pedrosillo) with maps
6. **Event Details (#details)**: Date, time, dress code, accommodation, transport, kids info
7. **Timeline (#timeline)**: Day-of schedule from 11:30h to 21:00h
8. **Gifts (#gifts)**: Wedding gift registry with progress bars
9. **Playlist (#playlist)**: Spotify embed and song suggestion form
10. **Guestbook (#guestbook)**: Guest messages and signing feature
11. **RSVP (#rsvp)**: Attendance confirmation form with menu selection

## Key Features & Functionality

### Interactive Elements

1. **Countdown Timer** (index.html:1972-1989)
   - Counts down to October 11, 2026 at 12:00:00
   - Updates every second
   - Displays days, hours, minutes, seconds

2. **Mobile Navigation** (index.html:1944-1958)
   - Hamburger menu for mobile devices
   - Full-screen overlay navigation
   - Auto-closes when link clicked

3. **Scroll Animations** (index.html:2004-2017)
   - Intersection Observer for fade-in effects
   - Applies `.visible` class when elements enter viewport
   - Configured with 10% threshold

4. **Forms** (Three interactive forms):
   - **RSVP Form** (index.html:2020-2028): Collects attendance, menu selection, allergies, bus needs
   - **Guestbook Form** (index.html:2031-2047): Adds guest messages dynamically
   - **Song Suggestion Form** (index.html:2050-2054): Music requests

5. **Smooth Scrolling** (index.html:1961-1969)
   - All anchor links scroll smoothly to sections

6. **Dynamic Header** (index.html:1992-2001)
   - Background opacity changes on scroll
   - Adds shadow after scrolling 100px

### Custom SVG Graphics

**Teresa Emblem** (index.html:1397-1415): Custom SVG featuring:
- Animated heart with gradient fill
- Arrow piercing the heart (Saint Teresa's mystical symbolism)
- Floating and glowing animations
- Represents the theme: "Y sin amor, todo es nada" (Without love, all is nothing)

## Development Workflow

### Local Development

Since this is a static HTML file, development is straightforward:

1. **Open the file**: Simply open `index.html` in a web browser
2. **Edit**: Modify the HTML file directly
3. **Refresh**: Reload the browser to see changes

**Recommended workflow**:
```bash
# Option 1: Open directly in browser
open index.html  # macOS
xdg-open index.html  # Linux

# Option 2: Use a local server (recommended for testing)
python3 -m http.server 8000
# Then visit http://localhost:8000
```

### Making Changes

**Content Updates**:
- Text content: Search for Spanish text and update directly
- Colors: Modify CSS variables in the `:root` selector (lines 14-22)
- Dates: Update the wedding date in multiple locations (title, hero, countdown script)
- Locations: Update Google Maps iframe src URLs

**Structural Changes**:
- Add new sections between existing `<section>` tags
- Follow the existing pattern: section → container → content
- Add navigation links in the header `<ul class="nav-links">` (line 1374)

## Git Workflow

### Branch Strategy

- **Development branches**: Use `claude/` prefix followed by session ID
  - Format: `claude/claude-md-miyp8slvniv00gq1-[SESSION_ID]`
  - Example: `claude/claude-md-miyp8slvniv00gq1-01SoCyAq3rRG2GfdpMRrxH6v`

- **IMPORTANT**: All development and pushes must use the designated `claude/` branch
- Never push directly to main without explicit permission

### Commit Practices

**Good commit messages**:
- "Update wedding date and countdown timer"
- "Add accommodation information section"
- "Fix mobile menu navigation bug"
- "Update color scheme to match theme"

**Commit workflow**:
```bash
# Check status
git status

# Add changes
git add index.html

# Commit with descriptive message
git commit -m "Update RSVP form with dietary restrictions"

# Push to the designated branch
git push -u origin claude/[BRANCH_NAME]
```

### Retry Logic

If network issues occur:
- **Push operations**: Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- **Fetch/pull operations**: Same retry strategy
- Push will fail with 403 if branch name doesn't match the required format

## Key Conventions for AI Assistants

### Code Style

1. **Indentation**: 4 spaces (HTML, CSS, JavaScript)
2. **Quotes**: Double quotes for HTML attributes, single quotes for JavaScript strings
3. **CSS**: Inline styles organized by section, mobile-responsive breakpoints at 992px and 768px
4. **JavaScript**: ES6+ syntax, event listeners instead of inline handlers

### Content Guidelines

1. **Language**: All user-facing content must be in Spanish
2. **Tone**: Warm, elegant, romantic but approachable
3. **Typography**:
   - Headings: `Cormorant Garamond` (serif)
   - Body: `Montserrat` (sans-serif)
4. **Emojis**: Used sparingly in placeholder content and icons

### Responsive Design

The site uses a mobile-first approach with breakpoints:
- **Desktop**: Default styles
- **Tablet**: `@media (max-width: 992px)` (line 1244)
- **Mobile**: `@media (max-width: 768px)` (line 1266)

**Key responsive behaviors**:
- Mobile menu: Hamburger → full-screen overlay
- Grid layouts: Reduce columns (4 → 2 → 1)
- Timeline: Switch from alternating to single-column
- Countdown: Smaller sizing

### Placeholders to Replace

When customizing, these placeholders need replacement:

1. **Images**: All `.placeholder-image` and `.gallery-placeholder` divs
2. **Names**: `[Nombre del Padrino]`, etc. in the Padrinos section
3. **Maps**: Google Maps embed URLs (update with actual coordinates)
4. **Spotify**: Replace playlist URL with couple's actual playlist
5. **Gift items**: Update gift list with actual registry items

## Form Handling

### Important Notes

Currently, all forms use `alert()` for user feedback and don't persist data. For production:

1. **Backend required**: Forms need server-side handling or service integration
2. **Options**:
   - Form submission service (Formspree, Google Forms API, Netlify Forms)
   - Custom backend (Node.js + database)
   - Serverless functions (AWS Lambda, Netlify Functions)

3. **Data to collect**:
   - RSVP: name, email, phone, guests, attendance, menu, allergies, bus, message
   - Guestbook: message, name
   - Song suggestions: song name, artist, suggester name

### Security Considerations

- Forms currently have no validation beyond basic HTML5 `required` attributes
- No CSRF protection (add when implementing backend)
- No rate limiting (implement when adding backend)
- Consider honeypot fields for spam prevention

## Deployment

### Static Hosting Options

This site can be deployed to any static hosting service:

1. **GitHub Pages**:
   - Enable in repository settings
   - Serves from root or `/docs` folder

2. **Netlify**:
   - Connect repository
   - Deploy automatically on push
   - Can add Netlify Forms easily

3. **Vercel**:
   - Import from GitHub
   - Automatic deployments

4. **AWS S3 + CloudFront**:
   - Upload `index.html` to S3 bucket
   - Configure CloudFront for CDN

### Domain Configuration

The repository name suggests deployment at `boda.raquelyadrian.com`:
- Configure DNS A/CNAME records to point to hosting service
- Enable HTTPS (most services provide this automatically)
- Consider www vs non-www redirect

## Performance Optimization

### Current State
- **Single file**: ~70KB HTML file
- **External resources**: Loaded from CDNs
- **No bundling**: Direct browser execution

### Potential Improvements (If Needed)
1. Separate CSS and JS into external files
2. Optimize/compress images when added
3. Add lazy loading for images and iframes
4. Minify HTML/CSS/JS for production
5. Add service worker for offline capability

## Testing Checklist

When making changes, verify:

- [ ] Mobile navigation works (hamburger menu)
- [ ] All anchor links scroll to correct sections
- [ ] Countdown timer displays and updates
- [ ] Forms show appropriate feedback
- [ ] Responsive design works at different screen sizes
- [ ] All animations trigger on scroll
- [ ] External embeds (maps, Spotify) load correctly
- [ ] Spanish language/grammar is correct
- [ ] No console errors in browser

## Common Tasks Reference

### Update Wedding Date
1. Update page title (line 6)
2. Update hero date display (line 1420)
3. Update countdown JavaScript (line 1973)
4. Update footer (line 1938)

### Add New Section
```html
<section id="new-section" class="new-section">
    <div class="container">
        <h2 class="section-title fade-in">Section Title</h2>
        <!-- Content here -->
    </div>
</section>
```
Then add to navigation (line 1374-1385).

### Modify Color Scheme
Update CSS variables in `:root` (lines 14-22) and all colors update automatically.

### Add New Form Field
Follow existing patterns in RSVP form (lines 1842-1929), ensuring proper labels and accessibility attributes.

## Browser Support

**Tested/Expected to work**:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

**Features requiring modern browsers**:
- CSS Grid
- CSS Custom Properties
- Intersection Observer API
- ES6 JavaScript features

## Santa Teresa de Jesús Theme

The wedding theme centers around **Santa Teresa de Jesús** (Saint Teresa of Ávila):

- **Motto**: "Y sin amor, todo es nada" (Without love, all is nothing)
- **Location significance**: Wedding in Ávila, Teresa's birthplace
- **Symbolism**: The emblem features a heart pierced by an arrow, referencing Teresa's mystical "Transverberation"
- **Color palette**: Earthy, warm tones reflecting Teresa's Carmelite heritage

When making changes, maintain this thematic coherence.

## Accessibility Notes

**Current accessibility features**:
- Semantic HTML structure
- `aria-label` on mobile menu button
- Form labels properly associated
- Sufficient color contrast (verify with tools)

**Could be improved**:
- Add skip-to-content link
- Add alt text when real images replace placeholders
- Ensure all interactive elements are keyboard accessible
- Add ARIA labels to icon-only buttons
- Test with screen readers

## Contact & Support

For questions about the codebase or to report issues:
- Repository owner: mimeticflaneur
- Wedding couple: Raquel & Adrián
- Wedding date: October 11, 2026

## Version History

- **Initial commit** (0e31487): Repository creation
- **File upload** (f17ebd3): Added index.html with complete wedding website
- **Current session**: Adding CLAUDE.md documentation

---

**Last Updated**: December 9, 2025
**For AI Assistant**: When working with this repository, always maintain the elegant, romantic tone and ensure all changes respect the Spanish language and cultural context. Test thoroughly on mobile devices as many wedding guests will access via smartphones.
