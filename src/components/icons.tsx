// ─── Bibliothèque d'icônes de l'appli : Phosphor (graisse bold) ─────────────
// Un seul point d'entrée : les composants gardent les noms historiques pour
// que le reste du code ne bouge pas. Les exports « ssr » de Phosphor sont
// sans contexte React — utilisables partout, Server Components compris.
// La graisse « bold » est posée ici, une fois pour toutes.

import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  Pulse, Warning, Anchor as PAnchor, ArrowLeft as PArrowLeft, ChartBar,
  BookOpen as PBookOpen, Calendar as PCalendar, CalendarDots, Check as PCheck,
  CheckCircle, CaretDown, CaretLeft, CaretRight, CaretUp, Clock as PClock,
  Crown as PCrown, DownloadSimple, Barbell, Eye as PEye, Flag as PFlag,
  Fire, Gauge as PGauge, Diamond, Gift as PGift, Question,
  ClockCounterClockwise, Hourglass as PHourglass, Image as PImage,
  Infinity as PInfinity, Bank, Stack, ListNumbers, CircleNotch,
  Lock as PLock, SignIn, SignOut, Magnet as PMagnet, MapPin as PMapPin,
  Minus as PMinus, Moon as PMoon, MusicNote, Palette as PPalette,
  PawPrint as PPawPrint, PencilSimple, Plus as PPlus, Path, Ruler as PRuler,
  Scales, MagnifyingGlass, GearSix, Shield as PShield, ShieldSlash,
  Sparkle, Star as PStar, Note, Sun as PSun, Target as PTarget,
  Ticket as PTicket, Trash, TrendUp, Trophy as PTrophy, LockOpen,
  UserPlus as PUserPlus, Users as PUsers, Vault as PVault, Wall,
  X as PX, Lightning, Package as PPackage, Cards as PCards, Key as PKey,
  ArrowsClockwise, Funnel as PFunnel,
} from "@phosphor-icons/react/dist/ssr";

function bold(Icon: ComponentType<IconProps>) {
  function BoldIcon(props: IconProps) {
    return <Icon weight="bold" {...props} />;
  }
  return BoldIcon;
}

export const Activity = bold(Pulse);
export const AlertTriangle = bold(Warning);
export const Anchor = bold(PAnchor);
export const ArrowLeft = bold(PArrowLeft);
export const BarChart3 = bold(ChartBar);
export const BookOpen = bold(PBookOpen);
export const Calendar = bold(PCalendar);
export const CalendarDays = bold(CalendarDots);
export const Check = bold(PCheck);
export const CheckCircle2 = bold(CheckCircle);
export const ChevronDown = bold(CaretDown);
export const ChevronLeft = bold(CaretLeft);
export const ChevronRight = bold(CaretRight);
export const ChevronUp = bold(CaretUp);
export const Clock = bold(PClock);
export const Crown = bold(PCrown);
export const Download = bold(DownloadSimple);
export const Dumbbell = bold(Barbell);
export const Eye = bold(PEye);
export const Flag = bold(PFlag);
export const Flame = bold(Fire);
export const Gauge = bold(PGauge);
export const Gem = bold(Diamond);
export const Gift = bold(PGift);
export const HelpCircle = bold(Question);
export const History = bold(ClockCounterClockwise);
export const Hourglass = bold(PHourglass);
export const Image = bold(PImage);
export const Infinity = bold(PInfinity);
export const Landmark = bold(Bank);
export const Layers = bold(Stack);
export const ListOrdered = bold(ListNumbers);
export const Loader2 = bold(CircleNotch);
export const Lock = bold(PLock);
export const LogIn = bold(SignIn);
export const LogOut = bold(SignOut);
export const Magnet = bold(PMagnet);
export const MapPin = bold(PMapPin);
export const Minus = bold(PMinus);
export const Moon = bold(PMoon);
export const Music = bold(MusicNote);
export const Palette = bold(PPalette);
export const PawPrint = bold(PPawPrint);
export const Pencil = bold(PencilSimple);
export const Plus = bold(PPlus);
export const Route = bold(Path);
export const Ruler = bold(PRuler);
export const Scale = bold(Scales);
export const Search = bold(MagnifyingGlass);
export const Settings = bold(GearSix);
export const Shield = bold(PShield);
export const ShieldOff = bold(ShieldSlash);
export const Sparkles = bold(Sparkle);
export const Funnel = bold(PFunnel);
export const Star = bold(PStar);
export const StickyNote = bold(Note);
export const Sun = bold(PSun);
export const Target = bold(PTarget);
export const Ticket = bold(PTicket);
export const Trash2 = bold(Trash);
export const TrendingUp = bold(TrendUp);
export const Trophy = bold(PTrophy);
export const Unlock = bold(LockOpen);
export const UserPlus = bold(PUserPlus);
export const Users = bold(PUsers);
export const Vault = bold(PVault);
export const Weight = bold(Wall);
export const X = bold(PX);
export const XIcon = X;
export const Zap = bold(Lightning);
export const Package = bold(PPackage);
export const Cards = bold(PCards);
export const Key = bold(PKey);
export const Spin = bold(ArrowsClockwise);
