import MascotCelebration from '../mascot/mascot-celebration';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MascotCelebration />
    </>
  );
}
