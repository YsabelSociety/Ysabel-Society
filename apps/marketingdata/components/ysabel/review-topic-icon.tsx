import { Accessibility, BookOpen, CalendarCheck, Clock3, DoorOpen, HeartHandshake, Leaf, MessageCircle, Music2, Sparkles, UserRoundCheck, Utensils, Wallet, Wine } from 'lucide-react';

export function ReviewTopicIcon({ topic, size = 19 }: { topic: string; size?: number }) {
  const Icon = ({ Food: Utensils, Drinks: Wine, Menu: BookOpen, Service: UserRoundCheck, Hospitality: HeartHandshake, Cleanliness: Sparkles, Reservations: CalendarCheck, Atmosphere: Music2, 'Waiting time': Clock3, 'Price & value': Wallet, 'Dietary needs': Leaf, Accessibility, 'Opening hours': DoorOpen } as Record<string, typeof Utensils>)[topic] || MessageCircle;
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
