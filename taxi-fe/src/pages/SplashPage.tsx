import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";

const slides = [
  {
    icon: "🚕",
    title: "Book a Ride",
    desc: "Request a ride in seconds. Choose your vehicle type and get matched with the nearest driver.",
  },
  {
    icon: "📍",
    title: "Track in Real-time",
    desc: "Watch your driver arrive on a live map. Get ETA updates and stay connected throughout your journey.",
  },
  {
    icon: "💳",
    title: "Easy Payment",
    desc: "Pay seamlessly with cash or VNPay. View fare breakdown and ride history anytime.",
  },
];

export function SplashPage() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-primary flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-4xl">🚖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">CAB Booking</h1>
          <p className="text-white/70 mt-1">Smart Taxi Platform</p>
        </div>

        {/* Slides */}
        <div className="bg-white rounded-2xl p-8 shadow-xl mb-6">
          <div className="text-5xl mb-4">{slides[current].icon}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{slides[current].title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{slides[current].desc}</p>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i === current ? "bg-indigo-600 w-8" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            fullWidth
            size="lg"
            className="!bg-white !text-indigo-700 hover:!bg-gray-50 !shadow-lg"
            onClick={() => navigate("/login")}
          >
            Get Started
          </Button>
          <p className="text-white/60 text-sm">
            Don't have an account?{" "}
            <button onClick={() => navigate("/register")} className="text-white underline font-medium">
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
