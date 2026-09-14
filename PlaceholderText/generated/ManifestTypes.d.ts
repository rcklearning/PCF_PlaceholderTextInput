/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    multilineMode: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    fieldHeightPx: ComponentFramework.PropertyTypes.WholeNumberProperty;
    value: ComponentFramework.PropertyTypes.StringProperty;
    placeholderText: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    value?: string;
}
