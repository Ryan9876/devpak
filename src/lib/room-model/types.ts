export type UnitSystem = 'imperial' | 'metric';
export type WorkspaceMode = 'organize' | 'arrange' | 'build';
export type MeasurementSource = 'manual' | 'photo_estimate' | 'ar' | 'lidar' | 'imported';
export type VerificationState = 'estimated' | 'verified' | 'corrected';
export type ObjectKind = 'furniture' | 'storage' | 'appliance' | 'fixture' | 'opening' | 'obstacle' | 'build';
export type Point2D={xUm:number;yUm:number};export type Size2D={widthUm:number;depthUm:number};
export interface RoomBoundary{widthUm:number;depthUm:number;ceilingHeightUm?:number|null}
export interface MeasurementEvidence{id:string;label:string;valueUm:number;toleranceUm:number;confidence:number;source:MeasurementSource;verification:VerificationState;deviceContext?:{platform?:string;model?:string;orientation?:string;captureMethod?:string;lidarCapable?:boolean}|null;calibration?:{referenceLabel:string;referenceValueUm:number}|null;correctionHistory:Array<{at:string;fromUm:number;toUm:number;reason?:string}>}
export interface RoomObject{id:string;label:string;kind:ObjectKind;position:Point2D;size:Size2D;rotationDeg:number;fixed:boolean;clearanceUm:number;source:'user'|'vision'|'system'|'build';confidence?:number|null;notes?:string|null}
export interface Opening{id:string;wall:'north'|'south'|'east'|'west';offsetUm:number;widthUm:number;kind:'door'|'window'|'passage';swing?:'in'|'out'|null}
export interface RoomModel{schemaVersion:2;id:string;projectId:string;name:string;units:UnitSystem;boundary:RoomBoundary;measurements:MeasurementEvidence[];objects:RoomObject[];openings:Opening[];assumptions:string[];updatedAt:string}
export interface PlanningProposal{id:string;mode:WorkspaceMode;title:string;summary:string;rationale:string[];assumptions:string[];placements:Array<{objectId:string;position:Point2D;rotationDeg:number}>;confidence:number;conflicts:string[];requiresVerification:string[]}
