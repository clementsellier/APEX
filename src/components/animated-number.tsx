"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/** Nombre qui « roule » jusqu'à sa nouvelle valeur. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 160, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
