import '../../styles/clouds.css';

interface Cloud {
  id: number;
  size: number;
  top: string;
  opacity: number;
  duration: number;
  delay: number;
}

const clouds: Cloud[] = [
  { id: 1, size: 120, top: '5%', opacity: 0.6, duration: 45, delay: 0 },
  { id: 2, size: 80, top: '15%', opacity: 0.4, duration: 55, delay: -20 },
  { id: 3, size: 150, top: '8%', opacity: 0.35, duration: 60, delay: -35 },
  { id: 4, size: 60, top: '20%', opacity: 0.45, duration: 40, delay: -10 },
  { id: 5, size: 100, top: '12%', opacity: 0.3, duration: 50, delay: -25 },
  { id: 6, size: 90, top: '3%', opacity: 0.5, duration: 65, delay: -45 },
  { id: 7, size: 70, top: '18%', opacity: 0.35, duration: 48, delay: -15 },
  { id: 8, size: 130, top: '6%', opacity: 0.3, duration: 70, delay: -55 },
];

export function AnimatedClouds() {
  return (
    <div className="clouds-container">
      {clouds.map((cloud) => (
        <img
          key={cloud.id}
          src="/images/cloud.png"
          alt=""
          className="cloud"
          style={{
            width: `${cloud.size}px`,
            top: cloud.top,
            opacity: cloud.opacity,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
