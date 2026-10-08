// Immersia Rentals catalogue — no prices on purpose; enquiries go to WhatsApp.
//
// Videos stream from Cloudinary only when a thumbnail is clicked. By default an
// item's video is expected at `<folder>/<item id>` (e.g. `rentals/q3`), so
// uploading a clip with that public ID is enough to make it show up. Set
// `video` on an item to point at a different public ID instead.

export const CLOUDINARY_CLOUD_NAME =
  (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || '').trim() || 'c6znesoe';
export const CLOUDINARY_RENTALS_FOLDER =
  (process.env.REACT_APP_CLOUDINARY_RENTALS_FOLDER || '').trim() || 'rentals';
// 720p rendition of the reel (13.5 MB original → ~3 MB).
export const SHOWREEL_URL =
  (process.env.REACT_APP_RENTALS_SHOWREEL_URL || '').trim() ||
  'https://res.cloudinary.com/c6znesoe/video/upload/q_auto:eco,h_720,c_limit/v1791396790/reel.mp4';

// Local 0813 701 3560 — wa.me needs it in international form without the '+'.
export const CONTACT = {
  whatsapp: '2348137013560',
  phone: '+2348137013560',
  phoneDisplay: '0813 701 3560',
};

export type RentalItem = {
  id: string;
  name: string;
  blurb: string;
  thumb: string;
  /** Cloudinary public ID; defaults to `${CLOUDINARY_RENTALS_FOLDER}/${id}`. */
  video?: string;
  badge?: string;
  contain?: boolean;
  emoji?: string;
};

export type RentalCategory = {
  id: string;
  name: string;
  short: string;
  icon: string;
  items: RentalItem[];
};

const t = (file: string) => `/rentals/${file}`;

export const CATEGORIES: RentalCategory[] = [
  {
    id: 'vr', name: 'VR and holograms', short: 'VR & Holo', icon: '🥽',
    items: [
      { id: 'q3', name: 'Meta Quest 3', blurb: 'Mixed-reality headset with a full library of games.', thumb: t('q3.jpg') },
      { id: 'q2', name: 'Meta Quest 2', blurb: 'Standalone VR that drops guests straight into the action.', thumb: t('q2.jpg') },
      { id: 'race', name: 'VR racing simulator', blurb: 'Wheel, pedals and a seat built for speed.', thumb: t('race.jpg') },
      { id: 'motion', name: 'VR motion simulator', blurb: 'The seat moves with the ride. Hold on tight.', thumb: t('motion.jpg') },
      { id: 'holo3d', name: '3D hologram', blurb: 'Floating 3D visuals that stop people mid-step.', thumb: t('holo3d.jpg') },
      { id: 'holobox', name: 'Holobox hologram', blurb: 'Life-size holographic presence for big reveals.', thumb: t('holobox.jpg') },
    ],
  },
  {
    id: 'booths', name: 'Photo and video booths', short: 'Booths', icon: '📸',
    items: [
      { id: 'aibooth', name: 'Customisable AI video booth', blurb: 'AI-styled clips your guests will want to share.', thumb: t('aibooth.jpg') },
      { id: 'illusion', name: 'Illusion photo booth', blurb: 'Mind-bending shots that look impossible.', thumb: t('illusion.jpg') },
      { id: 'tunnel', name: 'Light tunnel booth', blurb: 'Walk through a corridor of light and colour.', thumb: t('tunnel.jpg') },
      { id: 'sleek', name: 'Sleek photo booth', blurb: 'Clean, modern prints and instant sharing.', thumb: t('sleek.jpg') },
      { id: 'magazine', name: 'Magazine photo booth', blurb: 'Every guest gets their own cover moment.', thumb: t('magazine.jpg') },
      { id: 'v360', name: '360 video booth', blurb: 'Slow-motion spins that capture the whole vibe.', thumb: t('v360.jpg') },
    ],
  },
  {
    id: 'music', name: 'Music, dance and interactive', short: 'Music & Interactive', icon: '🎤',
    items: [
      { id: 'dance', name: 'Just Dance station', blurb: 'Gets the whole room moving in seconds.', thumb: t('dance.jpg') },
      { id: 'karaoke', name: 'Karaoke machine', blurb: 'Mics, lyrics on screen and endless songs.', thumb: t('karaoke.jpg') },
      { id: 'disco', name: 'Silent disco headsets', blurb: 'Multiple channels, one dance floor, zero noise complaints.', thumb: t('disco.jpg') },
      { id: 'kiosk', name: 'Interactive screen games (kiosk)', blurb: 'Touch-screen games for walk-up play.', thumb: t('kiosk.jpg') },
      { id: 'table', name: 'Interactive screen games (table)', blurb: 'Gather round a table that plays back.', thumb: t('table.jpg') },
      { id: 'ar', name: 'Customised AR experience', blurb: 'Augmented reality built around your brand.', thumb: t('ar.jpg') },
    ],
  },
  {
    id: 'games', name: 'Consoles and arcade', short: 'Consoles & Arcade', icon: '🎮',
    items: [
      { id: 'f1', name: 'Triple-screen F1 racing', blurb: 'Wraparound screens for full racing immersion.', thumb: t('f1.jpg') },
      { id: 'bowling', name: 'AR bowling', blurb: 'Strike anywhere — no lanes needed.', thumb: t('bowling.jpg') },
      { id: 'ps5', name: 'PlayStation 5', blurb: 'The latest titles, ready for head-to-head play.', thumb: t('ps5.jpg'), contain: true },
      { id: 'ps4', name: 'PlayStation 4', blurb: 'Classic crowd-pleasers for every age.', thumb: t('ps4.png'), contain: true },
      { id: 'basket', name: 'Basketball arcade', blurb: 'Shoot hoops against the clock.', thumb: t('basket.jpg') },
      { id: 'tennis', name: 'Table tennis', blurb: 'Fast rallies and friendly rivalry.', thumb: t('tennis.jpg') },
      { id: 'gorilla', name: 'Gorilla mascot', blurb: 'A larger-than-life guest for photos and hype.', thumb: '', emoji: '🦍' },
      { id: 'chair', name: 'Gaming chair with lights', blurb: 'RGB-lit seating that looks the part.', thumb: t('chair.jpg') },
      { id: 'gun', name: 'VR gun stock', blurb: 'Steadier aim for VR shooters.', thumb: t('gun.png'), contain: true },
    ],
  },
  {
    id: 'rides', name: 'Go-karts and rides', short: 'Karts & Rides', icon: '🏎️',
    items: [
      { id: 'karts', name: 'Electric go-karts', blurb: 'Quiet, quick and built for tight turns.', thumb: t('karts.jpg') },
      { id: 'ghost', name: 'Ghost Rider bike', blurb: 'A ride with serious attitude.', thumb: t('ghost.jpg') },
      { id: 'carousel', name: 'Kids carousel', blurb: 'Lights, music and round-and-round joy.', thumb: t('carousel.jpg') },
      { id: 'pbike', name: 'Electric power bike', blurb: 'Zippy fun for young riders.', thumb: t('pbike.jpg') },
      { id: 'animal', name: 'Animal rides', blurb: 'Plush ride-on animals kids love.', thumb: t('animal.jpg') },
      { id: 'hover', name: 'Hoverboard', blurb: 'Glide around the venue in style.', thumb: t('hover.jpg') },
    ],
  },
  {
    id: 'screens', name: 'Screens with stands', short: 'Screens', icon: '🖥️',
    items: [
      { id: 'tv65', name: 'Smart TV, 65 inch', blurb: 'Big-screen play and presentations.', thumb: t('screens.jpg'), badge: '65″' },
      { id: 'tv60', name: 'Smart TV, 60 inch', blurb: 'A crisp centrepiece for any setup.', thumb: t('screens.jpg'), badge: '60″' },
      { id: 'tv50', name: 'Smart TV, 50 inch', blurb: 'Ideal for console and VR stations.', thumb: t('screens.jpg'), badge: '50″' },
      { id: 'tv32', name: 'Smart TV, 32 inch', blurb: 'Compact and easy to place.', thumb: t('screens.jpg'), badge: '32″' },
      { id: 'ts65', name: 'Interactive touch screen, 65 inch', blurb: 'Tap, swipe and play at scale.', thumb: t('screens.jpg'), badge: '65″ touch' },
      { id: 'ts50', name: 'Interactive touch screen, 50 inch', blurb: 'Hands-on content for activations.', thumb: t('screens.jpg'), badge: '50″ touch' },
      { id: 'ts32', name: 'Interactive touch screen, 32 inch', blurb: 'Kiosk-sized interactive display.', thumb: t('screens.jpg'), badge: '32″ touch' },
      { id: 'led', name: 'Large LED screen', blurb: 'Stage-sized visuals, built to your space.', thumb: t('screens.jpg'), badge: 'LED' },
    ],
  },
];

export const SERVICES = [
  { title: 'Parties', text: 'Rides, booths and games that get guests moving', thumb: t('karts.jpg'), jump: 'rides' },
  { title: 'Corporate events', text: 'Launches, activations and brand moments', thumb: t('aibooth.jpg'), jump: 'booths' },
  { title: 'Gaming and entertainment', text: 'VR, simulators, consoles and arcades', thumb: t('race.jpg'), jump: 'vr' },
];

export const REVIEWS = [
  { quote: 'The team was incredibly helpful and patient in answering all my questions. The delivery was on time, and setup instructions were clear. I’ll definitely rent from them again!', name: 'Aisha O.', place: 'Lagos' },
  { quote: 'I rented a VR headset for my son’s birthday party, and it was a massive hit! The equipment was in excellent condition, and the games worked flawlessly.', name: 'Michael D.', place: 'Birthday party' },
  { quote: 'We rented a full gaming setup for our company’s team-building event. The package included everything we needed, and the staff provided excellent support throughout.', name: 'Chike M.', place: 'Team building' },
];

export const FAQS = [
  { q: 'Do you offer discounts for long-term rentals or group events?', a: 'Yes. We give special discounts for long-term rentals, group events and bulk bookings. Message us for a custom quote.' },
  { q: 'How long is a rental?', a: 'Each booking covers a 6-hour rental. Need longer? Extensions are available, subject to availability.' },
  { q: 'Do you provide technical support?', a: 'Yes. Our team handles setup and troubleshooting on site so your event runs smoothly.' },
  { q: 'Do consoles and VR headsets come with a screen?', a: 'PlayStations and Meta Quests need a screen. Rent one from us in the size you want, or use your venue’s TVs — we confirm compatibility before your event. The karaoke machine already includes a 32-inch screen.' },
  { q: 'How do delivery and setup work?', a: 'Delivery, transport and setup are arranged based on your venue and event size. Send us the location on WhatsApp and we’ll confirm logistics.' },
];

export const ALL_ITEMS: (RentalItem & { categoryId: string; categoryName: string })[] =
  CATEGORIES.flatMap((c) => c.items.map((it) => ({ ...it, categoryId: c.id, categoryName: c.name })));

export const videoUrlFor = (item: RentalItem) => {
  const publicId = item.video || `${CLOUDINARY_RENTALS_FOLDER}/${item.id}`;
  // Originals are 5–10 MB phone clips. Capping to 720p (c_limit never upscales)
  // with q_auto:eco cuts that to ~1–2.5 MB; .mp4 keeps it playable everywhere.
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/q_auto:eco,h_720,c_limit/${publicId}.mp4`;
};

export const whatsappLink = (message: string) =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
