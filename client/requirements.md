## Packages
recharts | For visualizing metrics trends (mindset, skill, confidence)
framer-motion | For smooth page transitions and micro-interactions
date-fns | For robust date formatting in tables and cards
lucide-react | Icon set (already in base, but listing for completeness)
clsx | Utility for conditional classes
tailwind-merge | Utility for merging tailwind classes

## Notes
- Using Web Speech API for voice-to-text input to avoid complex backend audio streaming setup for the MVP.
- Authentication relies on Replit Auth (via useAuth hook).
- Data fetching uses TanStack Query v5 conventions.
- The app assumes standard shadcn/ui components are available in @/components/ui/*.
