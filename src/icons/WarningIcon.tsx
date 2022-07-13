import React from 'react';

export function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
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
                d="M8 16A8 8 0 118 0a8 8 0 010 16zm0-7a1 1 0 001-1V4a1 1 0 10-2 0v4a1 1 0 001 1zm0 1a1 1 0 100 2 1 1 0 000-2z"
            />
        </svg>
    );
}
