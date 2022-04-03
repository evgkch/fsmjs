import { Signal, IReceiver } from '/emitterjs';
export declare type Pointer = number | string | symbol;
export interface IEvent {
    type: Signal;
}
export interface IDispatcher<E extends IEvent> {
    dispatch(event: E): boolean;
}
export interface IAsyncDispatcher<E extends IEvent> {
    dispatchAsync(event: E): Promise<boolean>;
}
export declare type Transition<P extends Pointer, S = undefined, E extends IEvent = IEvent> = {
    to: P;
    if: (event: E, state: S) => boolean;
    update?: (event: E, state: S) => void;
};
export declare type Scheme<P extends Pointer, S = undefined, E extends IEvent = IEvent> = {
    [p in P]?: Transition<P, S, E>[];
};
export declare type StateSignalMap<P extends Pointer, S = undefined, E extends IEvent = IEvent> = {
    [p in P]: [event: E, state: S];
};
export interface IFSM<P extends Pointer, S = undefined, E extends IEvent = IEvent> extends IDispatcher<E>, IAsyncDispatcher<E>, IReceiver<StateSignalMap<P, S, E>> {
    readonly isActive: boolean;
    readonly pointer: P;
    readonly state: S;
}
declare class FSM<P extends Pointer, S = undefined, E extends IEvent = IEvent> implements IFSM<P, S, E> {
    #private;
    constructor(scheme: Scheme<P, S, E>, initialPointer: P, state: S);
    get pointer(): P;
    get state(): S;
    get isActive(): boolean;
    dispatch(event: E): boolean;
    dispatchAsync(event: E): Promise<boolean>;
    on<K extends P>(pointer: K, listener: (...args: StateSignalMap<K, S, E>[K]) => any): this;
    once<K extends P>(pointer: K, listener: (...args: StateSignalMap<K, S, E>[K]) => any): this;
    onweak<K extends P>(pointer: K, listener: (...args: StateSignalMap<K, S, E>[K]) => any): this;
    off<K extends P>(pointer: K, listener: (...args: StateSignalMap<K, S, E>[K]) => any): this;
}
export default FSM;
