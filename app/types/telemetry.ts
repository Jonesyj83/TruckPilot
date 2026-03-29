export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface TelemetryData {
    game: GameData;
    truck: TruckData;
    trailer: TrailerData;
    trailers?: TrailerData[];
    job: JobData;
    navigation: NavigationData;
    gameplay?: GameplayData;
}

export interface TruckData {
    id: string;
    make: string;
    model: string;
    licensePlate?: string;
    licensePlateCountryId?: string;
    licensePlateCountry?: string;
    speed: number;
    cruiseControlSpeed: number;
    cruiseControlOn: boolean;
    odometer: number;
    gear: number;
    displayedGear: number;
    forwardGears: number;
    reverseGears: number;
    shifterType: string;
    engineRpm: number;
    engineRpmMax: number;
    fuel: number;
    fuelCapacity: number;
    fuelRange?: number;
    fuelAverageConsumption: number;
    fuelWarningFactor: number;
    fuelWarningOn: boolean;
    wearEngine?: number;
    wearTransmission?: number;
    wearCabin?: number;
    wearChassis?: number;
    wearWheels?: number;
    userSteer: number;
    userThrottle: number;
    userBrake: number;
    userClutch: number;
    gameSteer: number;
    gameThrottle: number;
    gameBrake: number;
    gameClutch: number;
    shifterSlot: number;
    engineOn: boolean;
    electricOn: boolean;
    wipersOn: boolean;
    retarderBrake: number;
    retarderStepCount: number;
    parkBrakeOn: boolean;
    motorBrakeOn: boolean;
    brakeTemperature: number;
    adblue: number;
    adblueCapacity: number;
    adblueAverageConsumption: number;
    adblueWarningOn: boolean;
    airPressure: number;
    airPressureWarningOn: boolean;
    airPressureWarningValue: number;
    airPressureEmergencyOn: boolean;
    airPressureEmergencyValue: number;
    oilTemperature: number;
    oilPressure: number;
    oilPressureWarningOn: boolean;
    oilPressureWarningValue: number;
    waterTemperature: number;
    waterTemperatureWarningOn: boolean;
    waterTemperatureWarningValue: number;
    batteryVoltage: number;
    batteryVoltageWarningOn: boolean;
    batteryVoltageWarningValue: number;
    lightsDashboardValue: number;
    lightsDashboardOn: boolean;
    blinkerLeftActive: boolean;
    blinkerRightActive: boolean;
    blinkerLeftOn: boolean;
    blinkerRightOn: boolean;
    lightsParkingOn: boolean;
    lightsBeamLowOn: boolean;
    lightsBeamHighOn: boolean;
    lightsAuxFrontOn: boolean;
    lightsAuxRoofOn: boolean;
    lightsBeaconOn: boolean;
    lightsBrakeOn: boolean;
    lightsReverseOn: boolean;
    placement: Placement;
    acceleration: Vector3;
    head: Vector3;
    cabin: Vector3;
    hook: Vector3;
}

export interface GameData {
    connected: boolean;
    gameName: string;
    paused: boolean;
    time: string;
    timeScale: number;
    nextRestStopTime: string;
    version: string;
    serverVersion?: string;
    telemetryPluginVersion: string;
}

export interface TrailerData {
    attached: boolean;
    id: string;
    name: string;
    mass: number;
    wear: number;
    wearChassis?: number;
    wearWheels?: number;
    wearBody?: number;
    cargoDamage?: number;
    placement: Placement;
}

export interface JobData {
    income: number;
    deadlineTime: string; // ISO date string
    remainingTime: string; // ISO duration-like string
    sourceCity: string;
    sourceCityId?: string;
    sourceCompany: string;
    sourceCompanyId?: string;
    destinationCity: string;
    destinationCityId?: string;
    destinationCompany: string;
    destinationCompanyId?: string;
    cargoId?: string;
    cargo?: string;
    cargoMass?: number;
    plannedDistanceKm?: number;
    unitCount?: number;
    jobMarket?: string;
}

export interface NavigationData {
    estimatedTime: string;
    estimatedDistance: number;
    speedLimit: number;
}

export interface GameplayData {
    jobFinished?: boolean;
    jobCancelled?: boolean;
    jobDelivered?: boolean;
    fined?: boolean;
    tollgate?: boolean;
    ferry?: boolean;
    train?: boolean;
    refuel?: boolean;
    refuelPayed?: boolean;
}

interface Placement extends Vector3 {
    heading: number;
    pitch: number;
    roll: number;
}
