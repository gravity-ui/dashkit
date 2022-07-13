import React from 'react';

export function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="currentColor"
            {...props}
        >
            <path d="M7 14h7V7H7v7zM5 5h11v11H5V5zm4-2v1-1zm1-3H0v10V0h10zM0 10v1h4-4v-1zM10 0h1v4-4h-1zM3 9h1-1zM0 0h11v4H9V2H2v7h2v2H0V0z" />
        </svg>
    );
}
