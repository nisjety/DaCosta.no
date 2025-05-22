import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects | Your Portfolio',
  description: 'Showcase of my work, projects, and technical skills.',
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      {/* This layout wraps all routes under /projects */}
      {/* You can add projects-specific UI that should appear on all projects pages */}
      {children}
    </section>
  );
}
