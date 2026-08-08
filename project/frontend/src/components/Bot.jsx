import React from 'react';
import logo from '../assets/logo deptora.png';

const Bot = ({ size = 30, className = '', ...props }) => {
  return (
    <img
      src={logo}
      alt="Deptora AI"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      {...props}
    />
  );
};

export default Bot;