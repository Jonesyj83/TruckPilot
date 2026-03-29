export interface TelemetryUpdate {
    truck: TruckState;
    game: GameState;
    general: NavigationState;
    job: JobState;
}

export interface GameState {
    gameTime: string;
    gameConnected: boolean;
    hasInGameMarker: boolean;
}

export interface TruckState {
    truckCoords: [number, number] | null;
    truckHeading: number;
    truckSpeed: number;
    truckMake: string;
    truckModel: string;
    fuelCapacity: number;
    truckDamage: number | null;
    trailerDamage: number;
    trailerAttached: boolean;
    blinkerLeftActive: boolean;
    blinkerRightActive: boolean;
    headlightsOn: boolean;
    highBeamsOn: boolean;
}

export interface NavigationState {
    fuel: number;
    speedLimit: number;
    restStoptime: string;
    restStopMinutes: number;
    estimatedGameMinutes: number | null;
    estimatedDistanceKm: number | null;
}

export interface JobState {
    hasActiveJob: boolean;
    income: number;
    deadlineTime: Date;
    remainingTime: Date;
    sourceCity: string;
    sourceCompany: string;
    destinationCity: string;
    destinationCompany: string;
    cargoName: string;
    cargoMass: number;
}
