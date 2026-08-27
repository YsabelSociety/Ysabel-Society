"use client";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { BsArrowDownRight } from "react-icons/bs";

const AboutUsinHomePage = () => {
    const easeBezier = [0.16, 1, 0.3, 1] as const;

    const leftVariants: Variants = {
        hidden: { x: -40, opacity: 0 },
        visible: (i = 1) => ({
            x: 0,
            opacity: 1,
            transition: { delay: 0.12 * i, duration: 0.9, ease: easeBezier }
        })
    };
    const rightVariants: Variants = {
        hidden: { x: 40, opacity: 0 },
        visible: (i = 1) => ({
            x: 0,
            opacity: 1,
            transition: { delay: 0.18 + 0.12 * i, duration: 1.0, ease: easeBezier }
        })
    };
    const bottomVariants: Variants = {
        hidden: { y: 50, opacity: 0 },
        visible: {
            y: 0, opacity: 1,
            transition: { delay: 0.5, duration: 1.05, ease: easeBezier }
        }
    };

    return (
        <div className="relative bg-[#1D3428] px-6 lg:px-24 overflow-hidden">
            {/* Mobile-first layout */}
            <div className="lg:hidden max-w-md mx-auto py-14 flex flex-col gap-10">
                <motion.div
                    className="flex flex-col"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.35 }}
                >
                    <motion.div
                        className="relative flex items-center min-h-[25vh]"
                        variants={rightVariants}
                        custom={1}
                        style={{ willChange: "transform, opacity" }}
                    >
                        <p className="absolute left-0 top-1/2 -translate-y-1/2 text-[#BA8424] font-rhiffiral text-5xl uppercase leading-tight z-10 mx-auto">
                            A world beyond taste and time
                        </p>
                        <div className="ml-auto flex flex-col gap-4 w-[40%] shrink-0 relative z-0">
                            <div className="relative h-[30vh] aspect-[3/4] overflow-hidden">
                                <Image
                                    src="/assets/ysabel-3.png"
                                    alt="Dining lamp vignette"
                                    fill
                                    sizes="45vw"
                                    className="object-cover opacity-45"
                                />
                            </div>
                            
                        </div>
                      
                    </motion.div>
                    <div className="relative w-[53%] lg:w-full aspect-square overflow-hidden">
                                <Image
                                    src="/assets/asian good 6I9A0405 (1).png"
                                    alt="Place setting detail"
                                    fill
                                    sizes="45vw"
                                    className="object-cover"
                                />
                            </div>
                    <motion.p
                        className="text-[#BDBDB9] font-roboto text-base leading-relaxed pt-8"
                        variants={leftVariants}
                        custom={2}
                        style={{ willChange: "transform, opacity" }}
                    >
                        On the 22nd floor, the Italian restaurant tempts you with rich, soulful dishes and the warmth of true cucina vibes. One level higher, the Asian restaurant turns up the rhythm and bold flavors, open flame, and a fusion menu that hits every note. And at the very top, on the 24th floor, the Botanic Garden Rooftop comes alive, lush greenery, crafted cocktails, great vibe and the feeling that the city below is all yours.
                    </motion.p>
                   
                    <motion.button
                        className="self-start text-[#BA8424] uppercase tracking-[0.2em] text-xs flex items-center gap-1 pt-2"
                        variants={leftVariants}
                        custom={3}
                        style={{ willChange: "transform, opacity" }}
                    >
                        About us <BsArrowDownRight className="text-[12px] text-[#BA8424]" />
                    </motion.button>
                </motion.div>
                <motion.div
                    className="relative w-full self-start overflow-hidden"
                    variants={bottomVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.35 }}
                    style={{ willChange: "transform, opacity" }}
                >
                    <Image
                        src="/assets/good IMG_7834.png"
                        alt="Chef presenting dish"
                        width={900}
                        height={600}
                        className="w-full h-auto object-cover"
                        sizes="100vw"
                    />
                </motion.div>
            </div>
            {/* Desktop layout */}
            <div className="hidden lg:flex lg:flex-row max-w-7xl mx-auto overflow-hidden">
                <motion.div
                    className="lg:w-[30%] h-full flex flex-col lg:justify-center gap-6 py-16 lg:py-64"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ staggerChildren: 0.2 }}
                >
                    <motion.div
                        className="relative w-full sm:w-44 md:w-56 lg:w-72 xl:w-80 aspect-[327/252] overflow-hidden"
                        variants={leftVariants}
                        custom={1}
                        style={{ willChange: "transform, opacity" }}
                    >
                        <Image
                            src="/assets/asian good 6I9A0405 (1).png"
                            alt="Main"
                            fill
                            priority
                            sizes="(min-width:1280px) 20rem, (min-width:1024px) 18rem, (min-width:768px) 14rem, (min-width:640px) 11rem, 8rem"
                            className="object-contain"
                        />
                    </motion.div>
                    <motion.p
                        className="text-[#BDBDB9] font-roboto text-base text-left lg:pt-6"
                        variants={leftVariants}
                        custom={2}
                        style={{ willChange: "transform, opacity" }}
                    >
                        On the 22nd floor, the Italian restaurant tempts you with rich, soulful dishes and the warmth of true cucina vibes. One level higher, the Asian restaurant turns up the rhythm and bold flavors, open flame, and a fusion menu that hits every note. And at the very top, on the 24th floor, the Botanic Garden Rooftop comes alive, lush greenery, crafted cocktails, great vibe and the feeling that the city below is all yours.
                    </motion.p>
                    <motion.button
                        className="self-start text-[#BA8424] uppercase tracking-[0.1em] hover:underline hover:underline-offset-4 hover:duration-500 ease-in-out text-[23px] flex items-center gap-1"
                        variants={leftVariants}
                        custom={3}
                        style={{ willChange: "transform, opacity" }}
                    >
                        About us <BsArrowDownRight className="text-base text-[#BA8424]" />
                    </motion.button>
                </motion.div>
                <motion.div
                    className="lg:w-[70%] h-full flex flex-col lg:pl-16"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ staggerChildren: 0.28 }}
                >
                    <div className="flex flex-col lg:flex-row lg:justify-center space-y-5 lg:space-y-0">
                        <motion.p
                            className="text-5xl lg:text-[65px] z-30 relative font-rhiffiral uppercase lg:pt-32 text-[#BA8424] text-center leading-tight lg:w-[633px]"
                            variants={rightVariants}
                            custom={1}
                            style={{ willChange: "transform, opacity" }}
                        >
                            A world beyond taste and time
                        </motion.p>
                        <motion.div
                            className="relative h-[300px] w-[243px] lg:mt-16 overflow-hidden flex-shrink-0"
                            variants={rightVariants}
                            custom={2}
                            style={{ willChange: "transform, opacity" }}
                        >
                            <Image
                                src="/assets/ysabel-3.png"
                                alt="Dining room interior"
                                fill
                                sizes="(min-width:1024px) 243px, 50vw"
                                className="object-cover"
                            />
                        </motion.div>
                    </div>
                    <motion.div
                        className="relative w-full overflow-hidden py-10"
                        variants={bottomVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.25 }}
                        style={{ willChange: "transform, opacity" }}
                    >
                        <Image
                            src="/assets/good IMG_7834.png"
                            alt="Chef presenting dish"
                            width={1200}
                            height={800}
                            className="w-full h-auto object-cover"
                            sizes="100vw"
                        />
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default AboutUsinHomePage;


