'use client';

import Modal from './Modal';
import AboutContent from './AboutContent';

export default function AboutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <AboutContent />
    </Modal>
  );
}
