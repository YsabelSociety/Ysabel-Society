"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { BsChevronDown } from "react-icons/bs";
import { FiPhone } from "react-icons/fi";

const menuItems = [
  { label: "MENU", href: "/food-menu", type: "link", bgImage: "/assets/ysabel-1.png" },
  { label: "RESERVATION", href: "#reservation", bgImage: "/assets/ysabel-2.png" },
];

const bookLinks = [
  {
    href: "https://www.sevenrooms.com/explore/asian/reservations/create/search/?venues=asian%2Citalian",
    title: "Book for Asian",
    schedule: "Mon - Sun: 4:00 p.m. - 1:00 a.m.",
    external: true,
  },
  {
    href: "https://www.sevenrooms.com/explore/italian/reservations/create/search/?venues=italian%2Casian",
    title: "Book for Italian",
    schedule: "Mon - Sun: 11:00 a.m. - 12:00 a.m.",
    external: true,
  },
  {
    href: "https://www.sevenrooms.com/explore/rooftopkosovo/reservations/create/search",
    title: "Book for Garden",
    schedule: ["Mon - Fri: 7:00 a.m. - 1:00 a.m.", "Sat - Sun: 10:00 a.m. - 1:00 a.m."],
    external: true,
  },
];

const iconStyles = "w-8 h-8 fill-[#BDBDB9] transition group-hover:fill-white";

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

const EXIT_DURATION_MS = 1600;  // match CSS close wipe (1.6s)

const BOOK_MENU_TRANSITION_MS = 300;

interface HeaderProps {
  menuType?: "asian" | "italian" | "garden" | null;
}

const Header = ({ menuType = null }: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [overlayBookOpen, setOverlayBookOpen] = useState(false);
  const [bookMenuPortalVisible, setBookMenuPortalVisible] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const bookMenuRef = useRef<HTMLDivElement | null>(null);
  const overlayReservationRef = useRef<HTMLDivElement | null>(null);

  const asianSchedule = "Mon - Sun: 4:00 p.m. - 1:00 a.m.";
  const italianSchedule = "Mon - Sun: 11:00 a.m. - 12:00 a.m.";
  const gardenSchedule = ["Mon - Fri: 7:00 a.m. - 1:00 a.m.", "Sat - Sun: 10:00 a.m. - 1:00 a.m."];
  
  const getBookLink = () => {
    if (menuType === "asian") {
      return "https://www.sevenrooms.com/explore/asian/reservations/create/search/?venues=asian%2Citalian";
    } else if (menuType === "italian") {
      return "https://www.sevenrooms.com/explore/italian/reservations/create/search/?venues=italian%2Casian";
    } else if (menuType === "garden") {
      return "https://www.sevenrooms.com/explore/rooftopkosovo/reservations/create/search";
    }
    return null;
  };

  const getSchedule = () => {
    if (menuType === "asian") {
      return asianSchedule;
    } else if (menuType === "italian") {
      return italianSchedule;
    } else if (menuType === "garden") {
      return gardenSchedule;
    }
    return null;
  };

  useEffect(() => {
    if (!bookMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        bookMenuRef.current &&
        event.target instanceof Node &&
        !bookMenuRef.current.contains(event.target)
      ) {
        setBookMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [bookMenuOpen]);

  useEffect(() => {
    if (bookMenuOpen) {
      setBookMenuPortalVisible(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setBookMenuPortalVisible(false);
    }, BOOK_MENU_TRANSITION_MS);

    return () => window.clearTimeout(timeout);
  }, [bookMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      setBookMenuOpen(false);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleBookToggle = useCallback(() => {
    setBookMenuOpen((prev) => !prev);
  }, []);

  const handleBookClose = useCallback(() => {
    setBookMenuOpen(false);
    setOverlayBookOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setBookMenuOpen(false);

    if (open) {
      setIsClosing(true);
      setTimeout(() => {
        setOpen(false);
        setIsClosing(false);
      }, EXIT_DURATION_MS);
    } else {
      setOpen(true);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (!open) return;
    setIsClosing(true);
    setOverlayBookOpen(false);
    setHoveredMenuItem(null);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, EXIT_DURATION_MS);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBookMenuOpen(false);
    setOverlayBookOpen(false);
    setHoveredMenuItem(null);
  }, [open]);

  useEffect(() => {
    if (!overlayBookOpen || !open) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        overlayReservationRef.current &&
        event.target instanceof Node &&
        !overlayReservationRef.current.contains(event.target)
      ) {
        setOverlayBookOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [overlayBookOpen, open]);

  const handleLogoClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    handleClose();
  }, [handleClose]);

  const isOverlayVisible = open || isClosing;
  const overlayClass = open && !isClosing ? "menu-radial-reveal" : isClosing ? "menu-close-wipe" : "";

  return (
    <header className="absolute top-0 left-0 w-full z-30 px-6 md:px-10 py-16 bg-transparent flex items-center justify-between" style={{ height: '72px' }}>
      {/* Left: Book Now */}
      <div className="relative flex items-center" ref={bookMenuRef}>
        {menuType ? (
          // Show specific Book button with schedule for menu pages
          menuType === "garden" ? (
            // Garden: No link, just text
            <div className="flex flex-col items-start gap-1 px-2 py-1 uppercase tracking-[0.3em] text-xs font-roboto text-white">
              <a
              href={getBookLink() || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-start gap-1 py-1 uppercase tracking-[0.3em] text-xs font-roboto text-white transition-all duration-500 hover:text-[#BA8424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BA8424]"
            >
              <span>Book for Garden</span>
              {getSchedule() && Array.isArray(getSchedule()) ? (
                <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                  {(getSchedule() as string[]).map((line, index) => (
                    <span key={index}>{line}</span>
                  ))}
                </div>
              ) : getSchedule() ? (
                <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                  {getSchedule() as string}
                </span>
              ) : null}
              </a>
              <span className="text-[0.65rem] text-[#BA8424] md:text-[#BA8424] font-roboto tracking-wide normal-case italic mt-1">
                Kitchen does not work <br />from 14:30 pm - 16:00 pm
              </span>
            </div>
          ) : (
            // Asian/Italian: With link
            <a
              href={getBookLink() || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-start gap-1 px-2 py-1 uppercase tracking-[0.3em] text-xs font-roboto text-white transition-all duration-500 hover:text-[#BA8424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BA8424]"
            >
              <span>{`Book for ${menuType === "asian" ? "Asian" : "Italian"}`}</span>
              {getSchedule() && (
                <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                  {getSchedule()}
                </span>
              )}
            </a>
          )
        ) : (
          // Show dropdown Book Now for other pages
          <>
            <div className="hidden md:flex items-center">
              <button
                type="button"
                onClick={handleBookToggle}
                onBlur={(event) => {
                  if (
                    bookMenuRef.current &&
                    !bookMenuRef.current.contains(event.relatedTarget as Node)
                  ) {
                    handleBookClose();
                  }
                }}
                aria-haspopup="true"
                aria-expanded={bookMenuOpen}
                className="group inline-flex items-center justify-center gap-3 border border-white/40 bg-white/5 px-6 py-3 uppercase tracking-[0.3em] text-xs font-roboto text-white transition-all duration-500 hover:border-[#BA8424] hover:bg-[#BA8424]/90 hover:shadow-[0_18px_35px_rgba(186,132,36,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BA8424] cursor-pointer"
              >
                <span>Book Now</span>
                <BsChevronDown
                  className={`h-3 w-3 transition-transform duration-400 pointer-events-none ${bookMenuOpen ? "translate-y-0 rotate-180" : "translate-y-[1px]"}`}
                />
              </button>
              <div
                className={`absolute left-0 top-full mt-3 w-[min(18rem,calc(100vw-3rem))] overflow-hidden border border-white/10 bg-gradient-to-br from-[#15261E]/95 via-[#1D3428]/90 to-[#0B1611]/95 p-[1px] backdrop-blur-md transition-all duration-300 ${
                  bookMenuOpen ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
                }`}
              >
                <div className="relative bg-[#0F1A15]/90 p-4 ">
                  {bookLinks.map((link) => (
                    link.external ? (
                      <a
                        key={link.title}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleBookClose}
                        className="group flex flex-col gap-1 border border-transparent px-4 py-3 transition-all duration-300 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/15"
                      >
                        <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F0D0A2]">
                          {link.title}
                        </span>
                        {link.schedule && (
                          Array.isArray(link.schedule) ? (
                            <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                              {link.schedule.map((line, index) => (
                                <span key={index}>{line}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                              {link.schedule}
                            </span>
                          )
                        )}
                      </a>
                    ) : (
                      <Link
                        key={link.title}
                        href={link.href}
                        onClick={handleBookClose}
                        className="group flex flex-col gap-1 border border-transparent px-4 py-3 transition-all duration-300 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/15"
                      >
                        <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F0D0A2]">
                          {link.title}
                        </span>
                        {link.schedule && (
                          Array.isArray(link.schedule) ? (
                            <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                              {link.schedule.map((line, index) => (
                                <span key={index}>{line}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                              {link.schedule}
                            </span>
                          )
                        )}
                        {link.title === "Garden" && (
                          <span className="text-[0.55rem] text-[#BA8424] font-roboto tracking-wide normal-case italic mt-1">
                            Kitchen does not work from 14:30 p.m. - 16:00 p.m.
                          </span>
                        )}
                      </Link>
                    )
                  ))}
                  
                  {/* Phone Numbers Section */}
                  <div className="mt-4 pt-5 border-t border-white/10">
                    <div className="mb-3 px-3 py-2">
                      <span className="text-[0.65rem] text-white font-medium uppercase tracking-[0.2em] font-roboto">
                        Call Us
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <a 
                        href="tel:038705000"
                        className="group flex items-center transition-all duration-300 hover:opacity-80"
                      >
                        <span className="inline-flex w-7 h-7 items-center justify-center">
                          <FiPhone className="w-4 h-4 text-white transition-all duration-300 group-hover:text-[#F0D0A2]" />
                        </span>
                        <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F0D0A2] transition-colors duration-300">
                          038 70 50 00
                        </span>
                      </a>
                      <a 
                        href="tel:048705000"
                        className="group flex items-center py-2 transition-all duration-300 hover:opacity-80"
                      >
                        <span className="inline-flex w-7 h-7 items-center justify-center">
                          <FiPhone className="w-4 h-4 text-white transition-all duration-300 group-hover:text-[#F0D0A2]" />
                        </span>
                        <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F0D0A2] transition-colors duration-300">
                          048 70 50 00
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex md:hidden items-center relative z-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookToggle();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                aria-haspopup="true"
                aria-expanded={bookMenuOpen}
                className="relative z-50 flex items-center justify-center gap-2 px-3 py-3 text-base tracking-[0.1em] font-rhiffiral font-bold uppercase text-white transition-all duration-300 hover:bg-[#F5F1E9] active:scale-[0.98] cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
              >
                <span>Book Now</span>
                <BsChevronDown
                  className={`h-4 w-4 transition-transform duration-400 pointer-events-none flex-shrink-0 ${bookMenuOpen ? "translate-y-0 rotate-180" : "translate-y-[1px]"}`}
                />
              </button>
              {bookMenuPortalVisible && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${
                      bookMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                    onClick={handleBookClose}
                  />
                  <div
                    className={`fixed inset-x-4 top-[calc(72px+1rem)] z-50 origin-top rounded-none border border-white/10 bg-gradient-to-br from-[#11251C]/95 via-[#132D21]/90 to-[#0B1812]/95 p-[1px] shadow-[0_26px_60px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
                      bookMenuOpen
                        ? "scale-100 opacity-100 pointer-events-auto"
                        : "scale-95 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="rounded-none bg-[#0F1A15]/95 p-4">
                      <div className="flex flex-col gap-3">
                        {bookLinks.map((link) => (
                          link.external ? (
                            <a
                              key={link.title}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={handleBookClose}
                              className="group flex flex-col gap-1 rounded-none border border-white/10 bg-white/[0.06] px-4 py-4 text-left transition-all duration-200 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/20 hover:shadow-[0_20px_35px_rgba(0,0,0,0.4)]"
                            >
                              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F4D8AF]">
                                {link.title}
                              </span>
                              {link.schedule && (
                                Array.isArray(link.schedule) ? (
                                  <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule.map((line, index) => (
                                      <span key={index} className="block">{line}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule}
                                  </span>
                                )
                              )}
                            </a>
                          ) : (
                            <Link
                              key={link.title}
                              href={link.href}
                              onClick={handleBookClose}
                              className="group flex flex-col gap-1 rounded-none border border-white/10 bg-white/[0.06] px-4 py-4 text-left transition-all duration-200 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/20 hover:shadow-[0_20px_35px_rgba(0,0,0,0.4)]"
                            >
                              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F4D8AF]">
                                {link.title}
                              </span>
                              {link.schedule && (
                                Array.isArray(link.schedule) ? (
                                  <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule.map((line, index) => (
                                      <span key={index} className="block">{line}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule}
                                  </span>
                                )
                              )}
                              {link.title === "Garden" && (
                                <span className="text-[0.65rem] text-white/60 font-roboto tracking-wide normal-case italic mt-1">
                                  Kitchen does not work from 14:30 pm - 16:00 pm
                                </span>
                              )}
                            </Link>
                          )
                        ))}
                        
                        {/* Phone Numbers Section */}
                        <div className="mt-3 pt-4 border-t border-white/10">
                          <div className="mb-3 px-1">
                            <span className="text-[0.65rem] text-white font-medium uppercase tracking-[0.2em] font-roboto">
                              Call Us
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            <a 
                              href="tel:038705000"
                              className="group flex items-center gap-3.5 py-2.5 transition-all duration-200 hover:opacity-80"
                            >
                              <span className="inline-flex w-8 h-8 items-center justify-center">
                                <FiPhone className="w-4.5 h-4.5 text-white transition-all duration-200 group-hover:text-[#F4D8AF]" />
                              </span>
                              <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F4D8AF] transition-colors duration-200">
                                038 70 50 00
                              </span>
                            </a>
                            <a 
                              href="tel:048705000"
                              className="group flex items-center gap-3.5 py-2.5 transition-all duration-200 hover:opacity-80"
                            >
                              <span className="inline-flex w-8 h-8 items-center justify-center">
                                <FiPhone className="w-4.5 h-4.5 text-white transition-all duration-200 group-hover:text-[#F4D8AF]" />
                              </span>
                              <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F4D8AF] transition-colors duration-200">
                                048 70 50 00
                              </span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {/* Center: Logo absolutely centered using relative wrapper */}
      <div className="absolute pt-44 pl-3 lg:pl-0 lg:pt-16 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        <Link href="/" onClick={handleLogoClick} className="flex items-center justify-center">
          <Image
            src="/assets/ysabel-logo-white.png"
            alt="Ysabel Logo"
            width={180}
            height={60}
            className="object-contain select-none"
            priority={true}
          />
        </Link>
      </div>
      {/* Right: Food Menu button and Hamburger */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          className="z-40 relative flex items-center justify-center w-12 h-12 group focus:outline-none cursor-pointer"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={handleToggle}
        >
          <svg width="48" height="38" viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg">
<line x1="7" y1="14.5" x2="42" y2="14.5" stroke="#F2F2F2"/>
<line x1="7" y1="22.5" x2="42" y2="22.5" stroke="#F2F2F2"/>
</svg>

        </button>
      </div>

      {/* Fullscreen overlay menu with enter/exit animations */}
      {isOverlayVisible && (
        <div 
          className={`${overlayClass} fixed inset-0 w-full h-full z-40 flex flex-col justify-center items-center`}
          style={{
            backgroundImage: hoveredMenuItem 
              ? `url(${menuItems.find(item => item.label === hoveredMenuItem)?.bgImage})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            transition: 'background-image 0.5s ease-in-out'
          }}
        >
          {/* Overlay layer for better text readability */}
          <div 
            className="absolute inset-0 bg-[#1D3428]/85 transition-opacity duration-500"
            style={{
              opacity: hoveredMenuItem ? 0.85 : 0.95
            }}
          />
          {/* Background crest same as footer */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div className="relative w-[min(34rem,80vw)] h-[min(34rem,80vw)] opacity-65">
              <Image
                src="/assets/big-ysabel.png"
                alt="Ysabel crest background"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 80vw, 34rem"
                priority={false}
              />
            </div>
          </div>
          <button className="absolute top-10 right-6 z-50 cursor-pointer" aria-label="Close menu" onClick={handleClose}>
          <svg width="48" height="38" viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="12.4786" y1="6.27145" x2="37.2273" y2="31.0202" stroke="#F2F2F2"/>
            <line x1="11.7714" y1="31.0214" x2="36.5202" y2="6.27271" stroke="#F2F2F2"/>
          </svg>

          </button>
          <nav className="relative z-10 flex flex-col gap-10 items-center mt-16 px-6 text-center">
            {menuItems.map((item) => {
              if (item.label === "RESERVATION") {
                return (
                  <div
                    key={item.label}
                    ref={overlayReservationRef}
                    className="relative flex flex-col items-center"
                  >
                    <button
                      type="button"
                      onClick={() => setOverlayBookOpen((prev) => !prev)}
                      onMouseEnter={() => setHoveredMenuItem(item.label)}
                      onMouseLeave={() => setHoveredMenuItem(null)}
                      aria-haspopup="true"
                      aria-expanded={overlayBookOpen}
                      className="menu-link-special cursor-pointer text-[#BDBDB9] font-rhiffiral text-3xl md:text-6xl tracking-widest transition-all flex items-center gap-4"
                    >
                      <span className="reveal-wrap">
                        <span
                          className="menu-link-lineup"
                          style={{ animationDelay: `0s` }}
                        >
                          {item.label}
                        </span>
                      </span>
                      <BsChevronDown
                        className={`h-4 w-4 lg:h-6 lg:w-6 transition-transform duration-400 pointer-events-none ${overlayBookOpen ? "translate-y-0 rotate-180" : "translate-y-[1px]"}`}
                      />
                    </button>
                    <div
                      className={`mt-5 w-[min(18rem,calc(100vw-3rem))] overflow-hidden border border-white/10 bg-gradient-to-br from-[#15261E]/95 via-[#1D3428]/90 to-[#0B1611]/95 p-[1px] backdrop-blur-md transition-all duration-300 ${
                        overlayBookOpen
                          ? "pointer-events-auto opacity-100 translate-y-0"
                          : "pointer-events-none opacity-0 translate-y-2"
                      }`}
                    >
                      <div className="relative bg-[#0F1A15]/90 p-4">
                        {bookLinks.map((link) => (
                          link.external ? (
                            <a
                              key={link.title}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={handleClose}
                              className="group flex flex-col gap-1 border border-transparent px-4 py-3 transition-all duration-300 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/15"
                            >
                              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F0D0A2]">
                                {link.title}
                              </span>
                              {link.schedule && (
                                Array.isArray(link.schedule) ? (
                                  <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule.map((line, index) => (
                                      <span key={index} className="block">{line}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule}
                                  </span>
                                )
                              )}
                            </a>
                          ) : (
                            <Link
                              key={link.title}
                              href={link.href}
                              onClick={handleClose}
                              className="group flex flex-col gap-1 border border-transparent px-4 py-3 transition-all duration-300 hover:border-[#BA8424]/60 hover:bg-[#BA8424]/15"
                            >
                              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-white group-hover:text-[#F0D0A2]">
                                {link.title}
                              </span>
                              {link.schedule && (
                                Array.isArray(link.schedule) ? (
                                  <div className="flex flex-col text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule.map((line, index) => (
                                      <span key={index} className="block">{line}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-white/70 font-roboto tracking-wide normal-case">
                                    {link.schedule}
                                  </span>
                                )
                              )}
                              {link.title === "Garden" && (
                                <span className="text-[0.65rem] text-[#BA8424] md:text-[#BA8424] font-roboto tracking-wide normal-case italic mt-1">
                                  Kitchen does not work from 14:30 p.m. - 16:00 p.m.
                                </span>
                              )}
                            </Link>
                          )
                        ))}
                        
                        {/* Phone Numbers Section */}
                        <div className="mt-4 pt-5 border-t border-white/10">
                          <div className="mb-3 px-3 py-2">
                            <span className="text-[0.65rem] text-white font-medium uppercase tracking-[0.2em] font-roboto">
                              Call Us
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <a 
                              href="tel:038705000"
                              className="group flex items-center transition-all duration-300 hover:opacity-80"
                            >
                              <span className="inline-flex w-7 h-7 items-center justify-center">
                                <FiPhone className="w-4 h-4 text-white transition-all duration-300 group-hover:text-[#F0D0A2]" />
                              </span>
                              <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F0D0A2] transition-colors duration-300">
                                038 70 50 00
                              </span>
                            </a>
                            <a 
                              href="tel:048705000"
                              className="group flex items-center py-2 transition-all duration-300 hover:opacity-80"
                            >
                              <span className="inline-flex w-7 h-7 items-center justify-center">
                                <FiPhone className="w-4 h-4 text-white transition-all duration-300 group-hover:text-[#F0D0A2]" />
                              </span>
                              <span className="text-sm text-white font-roboto tracking-wide group-hover:text-[#F0D0A2] transition-colors duration-300">
                                048 70 50 00
                              </span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <a
                  href={item.href}
                  key={item.label}
                  onMouseEnter={() => setHoveredMenuItem(item.label)}
                  onMouseLeave={() => setHoveredMenuItem(null)}
                  className="menu-link-special text-[#BDBDB9] font-rhiffiral text-3xl md:text-6xl tracking-widest transition-all relative z-10"
                  onClick={handleClose}
                >
                  <span className="reveal-wrap">
                    <span className="menu-link-lineup" style={{ animationDelay: `0s` }}>
                      {item.label}
                    </span>
                  </span>
                </a>
              );
            })}
          </nav>
          {/* Logo and Social Icons bottom center */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-6">
            <Image
              src="/assets/ysabel-text.png"
              alt="Ysabel Logo Overlay"
              width={100}
              height={40}
              className="object-contain select-none opacity-60"
              priority={false}
            />
            <div className="flex items-center gap-6">
              <a
                href="https://www.instagram.com/ysabelsociety/"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.facebook.com/ysabelsociety"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
                aria-label="Facebook"
              >
                <FacebookIcon />
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
