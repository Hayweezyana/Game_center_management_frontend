import React, { useState, useEffect } from "react";
import santa from "./logo/santa.png"; // Path to your Santa Claus image
import "./MovingSanta.css"; // CSS file for styling

const MovingSanta: React.FC = () => {
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const moveSanta = () => {
            const randomTop = Math.random() * window.innerHeight * 0.8; // Random position within viewport
            const randomLeft = Math.random() * window.innerWidth * 0.8;
            setPosition({ top: randomTop, left: randomLeft });
        };

        // Move Santa every 2 seconds
        const interval = setInterval(moveSanta, 2000);

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, []);

    return (
        <img
            src={santa}
            alt="Santa Claus"
            className="santa-image"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        />
    );
};

export default MovingSanta;
