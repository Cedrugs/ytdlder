import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownProps, DropdownOption } from "../types/components";

export default function Dropdown({ options, defaultValue, onChange }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(defaultValue ?? options[0].label);

    const toggleDropdown = () => setIsOpen((prev) => !prev);

    const handleSelect = (option: DropdownOption) => {
        setSelected(option.label);
        setIsOpen(false);
        if (onChange) onChange(option.value);
    };

    return (
        <div className="relative w-full font-mono">
            <div className="flex w-full">
                <button
                    onClick={toggleDropdown}
                    className="bg-red-500 text-white px-2 py-4 rounded-2xl flex-grow flex justify-between items-center hover:bg-red-600 transition duration-300 text-xs sm:text-sm sm:px-4 lg:text-base lg:px-4 lg:py-5"
                >
                    {selected}
                    <ChevronDown className="ml-2 h-5 w-5 text-white text-xs" />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.ul
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 mt-2 w-full bg-zinc-800 shadow-lg rounded-2xl overflow-hidden"
                    >
                        {options.map((option) => (
                            <li
                                key={option.value}
                                onClick={() => handleSelect(option)}
                                className="px-6 py-3 text-white hover:bg-zinc-600 cursor-pointer transition duration-300 text-xs md:text-sm lg:text-base"
                            >
                                {option.label}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
