# Index study desk

Index uses a paper-and-ink study desk theme.

Palette: desk grey `#E9EDF2`, paper white `#FFFFFF`, ink navy `#14213D`, rule blue `#9DB8E0`, margin red `#E5484D`, marker yellow `#F5E663`. Green `#2F9E6B` communicates successful recall.

Type: Bricolage Grotesque for titles; Instrument Sans for controls and definitions; JetBrains Mono for compact counters; Nothing You Could Do for the sample card. All fonts are bundled with their open font licenses.

Layout: left-aligned headings and controls. A 1,024px content boundary keeps the library readable. Study modes narrow to 768px and give one task the main stage. On mobile, cards and controls stack without shrinking the text.

```text
Library                          Study
[Index]  Library Explore [Mode] Set title       [Close]
                                 [progress__________________]
Your study desk.   [Import]
Your sets         [Find a set]       Prompt
                                    --------------------
[ruled card] [ruled card]            Answer or reveal
[ruled card] [+ new set]             [feedback / actions]
```

The first review removed the repeating automatic hero flip, the highlighted slogan, and the empty local Explore screen. The remaining visual signature is the ruled paper card. Repetition signals study material; large decorative statistics and generic marketing sections do not enter the design.

Motion personality: responsive paper, with a calm landing. Signature easing `(0.2, 0, 0, 1)`; quick feedback 120–180ms, card transitions 200–350ms, page transitions 380ms. Springs handle direct manipulation. Card content, its shadow, and progress feedback respond together. No ambient loops compete with recall. Reduced motion removes transforms, and card backs remain readable through an explicit content switch.

The interface preview in `index-desk.png` shows the Learn setup in the same paper-and-ink theme, with neutral Index branding.
