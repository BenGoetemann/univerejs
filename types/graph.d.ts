declare global {
    /**
     * Define types for edges so they're easier to understand and maintain.
     */
    type DirectEdge = {
        type: "direct";
        to: Agent | string;
    };

    type ConditionalEdge = {
        type: "conditional";
        fn: (state: any) => Agent | string;
    };

    type Edge = DirectEdge | ConditionalEdge;
}

export { }