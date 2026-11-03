import { useCallback, useState } from "react";

export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((value) => !value);
  }, []);

  return {
    close,
    isOpen,
    open,
    setIsOpen,
    toggle,
  };
}
