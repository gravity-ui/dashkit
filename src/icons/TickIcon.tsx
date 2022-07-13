import React from 'react';

export function TickIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="currentColor"
            {...props}
        >
            <path
                fillRule="evenodd"
                d="M5.95 11.008L1.863 6.572.392 7.927l5.533 6.003 9.67-10.114-1.444-1.381z"
            />
        </svg>
    );
}
