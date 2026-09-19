"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiPhone } from "react-icons/fi";

const navigationPrimary = [
  { label: "Home", href: "/" },
  { label: "Philosophy", href: "#philosophy" },
  { label: "Menu", href: "/food-menu" },
];

const navigationSecondary = [
  { label: "About Us", href: "#about" },
  { label: "Reservation", href: "#reservation" },
  { label: "Contact", href: "#contact" },
];

const iconStyles =
  "fill-current transition-all duration-500 ease-out transform-gpu";

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className={iconStyles} aria-hidden="true">
    <path d="M12 7.35a4.65 4.65 0 1 0 0 9.3 4.65 4.65 0 0 0 0-9.3Zm0 7.65a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6.15-7.8a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0ZM21 7.62c-.05-1.09-.3-2.05-1.09-2.84S18.47 3.85 17.38 3.8C16.24 3.73 7.76 3.73 6.62 3.8 5.53 3.85 4.57 4.1 3.78 4.89 3 5.68 2.75 6.64 2.7 7.73 2.63 8.87 2.63 15.13 2.7 16.27c.05 1.09.3 2.05 1.09 2.84.79.79 1.75 1.04 2.84 1.09 1.14.07 9.62.07 10.76 0 1.09-.05 2.05-.3 2.84-1.09.79-.79 1.04-1.75 1.09-2.84.07-1.14.07-7.4 0-8.54ZM19.26 18a2.41 2.41 0 0 1-1.36 1.36c-.94.37-3.18.28-5.9.28s-4.96.08-5.9-.28A2.41 2.41 0 0 1 4.74 18c-.37-.94-.28-3.18-.28-5.9s-.08-4.96.28-5.9A2.41 2.41 0 0 1 6.1 4.84c.94-.37 3.18-.28 5.9-.28s4.96-.08 5.9.28A2.41 2.41 0 0 1 19.26 6.1c.37.94.28 3.18.28 5.9s.09 4.96-.28 5.9Z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className={iconStyles} aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.98H7.9V12h2.54V9.79c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.62.77-1.62 1.56V12h2.76l-.44 2.89h-2.32v6.98A10 10 0 0 0 22 12Z" />
  </svg>
);


const connectLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/ysabelsociety/",
    icon: InstagramIcon,
    external: true,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/ysabelsociety",
    icon: FacebookIcon,
    external: true,
  },
];

const Footer = () => {
  const footerRef = useRef<HTMLElement | null>(null);
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [progress, setProgress] = useState(0);
  const [wordmarkVisible, setWordmarkVisible] = useState(false);
  const scaleRef = useRef(1);
  const frameRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  const lerpChannel = (start: number, end: number) =>
    Math.round(start + (end - start) * progress);

  const topColor = `rgb(${lerpChannel(12, 35)}, ${lerpChannel(
    28,
    68
  )}, ${lerpChannel(22, 55)})`;
  const bottomColor = `rgb(${lerpChannel(15, 48)}, ${lerpChannel(
    32,
    82
  )}, ${lerpChannel(26, 66)})`;

  useEffect(() => {
    const updateScale = () => {
      if (!footerRef.current) {
        return;
      }

      const rect = footerRef.current.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;

      const distanceIntoView = viewportHeight - rect.top;
      const totalTravel = rect.height + viewportHeight;
      const rawProgress = distanceIntoView / totalTravel;
      const clampedProgress = Math.min(1, Math.max(0, rawProgress));
      const targetScale = 1 + clampedProgress * 0.3;
      const targetProgress = clampedProgress;

      if (Math.abs(targetScale - scaleRef.current) > 0.01) {
        scaleRef.current = targetScale;
        setScale(targetScale);
      }

      if (Math.abs(targetProgress - progressRef.current) > 0.01) {
        progressRef.current = targetProgress;
        setProgress(targetProgress);
      }
    };

    const onScroll = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateScale();
      });
    };

    updateScale();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScale);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScale);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = wordmarkRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWordmarkVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.45,
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden text-[#e8e3d8] flex flex-col tracking-[0.12em] px-[clamp(2rem,8vw,10rem)] pt-[clamp(4rem,14vw,11rem)] pb-8 md:px-[clamp(2.5rem,8vw,12rem)] md:pt-[clamp(5rem,9vw+2rem,11rem)]"
      style={{
        background: `linear-gradient(180deg, ${topColor} 0%, ${bottomColor} 100%)`,
      }}
    >
      {/* Elegant top border */}
      <div 
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(186,132,36,0.4)] to-transparent z-10"
        aria-hidden 
      />

      {/* Refined radial gradient */}
      <div 
        className="absolute -inset-[30%_-40%] opacity-[0.25] z-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 45%, rgba(186,132,36,0.15) 0%, rgba(28, 57, 46, 0.4) 35%, rgba(15, 32, 24, 0) 70%)"
        }}
        aria-hidden 
      />

      {/* Background crest */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0" aria-hidden>
        <div 
          className="relative w-[min(32rem,55vw)] aspect-square transition-transform duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)]"
          style={{ transform: `scale(${scale})` }}
        >
          <Image
            src="/assets/big-ysabel.png"
            alt="Ysabel crest"
            fill
            className="object-contain opacity-[0.35] animate-pulseGlow"
            priority={false}
            sizes="(max-width: 768px) 65vw, 38vw"
          />
        </div>
      </div>

      {/* Main content grid with elegant dividers */}
      <div className="relative z-[1] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[clamp(3rem,8vw,6rem)] md:gap-[clamp(3rem,6vw,7rem)] mb-[clamp(4rem,12vw,8rem)]">
        {/* Location Section */}
        <div className="flex flex-col">
          <div className="mb-6 pb-4 border-b border-[rgba(186,132,36,0.2)]">
            <span className="text-[0.65rem] text-[#BA8424] font-medium uppercase font-roboto">
              Location
            </span>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-[0.75rem] text-[#e8e3d8] uppercase font-light font-roboto leading-relaxed">
              Ukshin Hoti Street, Prishtina, Kosovo, 10000
            </span>
          </div>
        </div>

        {/* Hours Section */}
        <div className="flex flex-col">
          <div className="mb-6 pb-4 border-b border-[rgba(186,132,36,0.2)]">
            <span className="text-[0.65rem] text-[#BA8424] uppercase font-roboto">
              Opening Hours
            </span>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem]  text-[#BA8424] uppercase font-medium font-roboto">
                Asian
              </span>
              <span className="text-[0.75rem] text-[#e8e3d8] normal-case font-light font-roboto leading-relaxed">
                Mon - Sun: 4:00 p.m. - 1:00 a.m.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-[#BA8424] uppercase font-medium font-roboto">
                Italian
              </span>
              <span className="text-[0.75rem] text-[#e8e3d8] normal-case font-light font-roboto leading-relaxed">
                Mon - Sun: 11:00 a.m. - 12:00 a.m.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-[#BA8424] uppercase font-medium font-roboto">
                Garden
              </span>
              <div className="flex flex-col text-[0.75rem] text-[#e8e3d8] normal-case font-light font-roboto leading-relaxed">
                <span>Mon - Fri: 7:00 a.m. - 1:00 a.m.</span>
                <span>Sat - Sun: 10:00 a.m. - 1:00 a.m.</span>
              </div>
              <span className="text-[0.65rem] text-[#BA8424] font-light font-roboto italic mt-1">
                Kitchen does not work from 14:30 p.m. - 16:00 p.m.
              </span>
            </div>
          </div>
          
          {/* Phone Numbers Section */}
          <div className="mt-6 pt-6 border-t border-[rgba(186,132,36,0.15)]">
            <div className="flex flex-col gap-3">
              <a 
                href="tel:038705000"
                className="group inline-flex items-center gap-3 no-underline transition-all duration-500 ease-out"
              >
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-sm border border-[rgba(186,132,36,0.2)] bg-[rgba(186,132,36,0.05)] transition-all duration-500 ease-out group-hover:border-[#BA8424] group-hover:bg-[rgba(186,132,36,0.15)] group-hover:shadow-[0_0_12px_rgba(186,132,36,0.2)]">
                  <FiPhone className="w-4 h-4 text-[#e8e3d8] group-hover:text-[#F5E6C8] transition-colors duration-500" />
                </span>
                <span className="text-[0.75rem] text-[#e8e3d8] normal-case font-light font-roboto leading-relaxed group-hover:text-[#F5E6C8] transition-colors duration-500">
                  038 70 50 00
                </span>
              </a>
              <a 
                href="tel:048705000"
                className="group inline-flex items-center gap-3 no-underline transition-all duration-500 ease-out"
              >
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-sm border border-[rgba(186,132,36,0.2)] bg-[rgba(186,132,36,0.05)] transition-all duration-500 ease-out group-hover:border-[#BA8424] group-hover:bg-[rgba(186,132,36,0.15)] group-hover:shadow-[0_0_12px_rgba(186,132,36,0.2)]">
                  <FiPhone className="w-4 h-4 text-[#e8e3d8] group-hover:text-[#F5E6C8] transition-colors duration-500" />
                </span>
                <span className="text-[0.75rem] text-[#e8e3d8] normal-case font-light font-roboto leading-relaxed group-hover:text-[#F5E6C8] transition-colors duration-500">
                  048 70 50 00
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex flex-col">
          <div className="mb-6 pb-4 border-b border-[rgba(186,132,36,0.2)]">
            <span className="text-[0.65rem] text-[#BA8424] font-medium uppercase font-roboto">
              Navigation
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-2">
            <div className="flex flex-col gap-5">
              {navigationPrimary.map(({ label, href }) => (
                <Link 
                  key={label} 
                  href={href} 
                  className="group relative text-[0.75rem] text-[#e8e3d8] uppercase no-underline font-roboto transition-all duration-500 ease-out hover:text-[#F5E6C8] hover:tracking-[0.3em]"
                >
                  <span className="relative z-10">{label}</span>
                  <span className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-[#BA8424] to-transparent transition-all duration-500 ease-out group-hover:w-full"></span>
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-5">
              {navigationSecondary.map(({ label, href }) => (
                <Link 
                  key={label} 
                  href={href} 
                  className="group relative text-[0.75rem] text-[#e8e3d8] uppercase no-underline font-roboto transition-all duration-500 ease-out hover:text-[#F5E6C8] hover:tracking-[0.3em]"
                >
                  <span className="relative z-10">{label}</span>
                  <span className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-[#BA8424] to-transparent transition-all duration-500 ease-out group-hover:w-full"></span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Connect Section */}
        <div className="flex flex-col">
          <div className="mb-6 pb-4 border-b border-[rgba(186,132,36,0.2)]">
            <span className="text-[0.65rem] text-[#BA8424] font-medium uppercase font-roboto">
              Connect
            </span>
          </div>
          <div className="flex flex-col gap-5 mt-2">
            {connectLinks.map(({ label, href, icon: Icon, external }) => (
              <a
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="group inline-flex items-center gap-4 no-underline text-[#e8e3d8] uppercase text-[0.75rem] font-light font-roboto transition-all duration-500 ease-out hover:text-[#F5E6C8]"
              >
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-sm border border-[rgba(186,132,36,0.2)] bg-[rgba(186,132,36,0.05)] transition-all duration-500 ease-out group-hover:border-[#BA8424] group-hover:bg-[rgba(186,132,36,0.15)] group-hover:shadow-[0_0_12px_rgba(186,132,36,0.2)] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-[#e8e3d8] group-hover:[&_svg]:text-[#F5E6C8]">
                  <Icon />
                </span>
                <span className="text-[0.75rem] tracking-inherit">{label}</span>
              </a>
            ))}
          
          </div>
        </div>
      </div>

      {/* Elegant divider before wordmark */}
      <div 
        className="relative z-[1] w-full h-px bg-gradient-to-r from-transparent via-[rgba(186,132,36,0.3)] to-transparent mb-[clamp(3rem,10vw,6rem)]"
        aria-hidden 
      />

      {/* Refined wordmark */}
      <div
        ref={wordmarkRef}
        className={`relative z-[1] flex justify-center md:justify-start gap-[clamp(0.3rem,2.5vw,2rem)] text-[clamp(3.5rem,20vw,11rem)] tracking-[clamp(0.3rem,2.5vw,1.6rem)] lg:tracking-[clamp(0.9rem,3.5vw,8.6rem)] text-[#D4C5A9] uppercase font-rhiffiral leading-none mb-[clamp(2rem,6vw,4rem)] ${
          wordmarkVisible ? "pointer-events-none" : ""
        }`}
      >
        {"YSABEL".split("").map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className={`inline-block opacity-0 leading-none ${
              wordmarkVisible ? "animate-letterReveal" : ""
            }`}
            style={{ 
              animationDelay: `${index * 0.15}s`,
              transform: wordmarkVisible ? undefined : "translateY(60%) scale(0.96)",
              WebkitTextStroke: "2px rgba(212, 197, 169, 0.85)",
              lineHeight: "1"
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Copyright notice */}
      <div className="relative z-[1] flex justify-start items-center">
        <p className="text-[0.5rem] lg:text-[0.7rem] tracking-[0.2em] text-[#e8e3d8] uppercase">
          © {new Date().getFullYear()} Ysabel Society. All rights reserved.
        </p>
      </div>

      {/* Elegant bottom border */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(186,132,36,0.4)] to-transparent z-10"
        aria-hidden 
      />
    </footer>
  );
};

export default Footer;

