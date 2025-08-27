import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center h-screen w-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <motion.div
        className="w-16 h-16 border-4 border-t-4 border-indigo-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ ease: "linear", duration: 1, repeat: Infinity }}
      />
    </div>
  );
};

export default LoadingSpinner;