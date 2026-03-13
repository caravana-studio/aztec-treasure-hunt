use aztec::{macros::notes::note, protocol::{traits::Packable, address::AztecAddress}};

// Power types
pub global POWER_DETECTOR: u8 = 0;  // Metal detector - scan 3x3 area, returns treasure count
pub global POWER_COMPASS: u8 = 1;   // Compass - returns distance to nearest treasure
pub global POWER_SHOVEL: u8 = 2;    // Golden shovel - relocate one of your treasures
pub global POWER_TRAP: u8 = 3;      // Trap - opponent loses turn if they dig here

/// Private note representing a single-use power
/// Players start with: 3 detectors, 2 compasses, 1 shovel, 2 traps
#[derive(Eq, Packable)]
#[note]
pub struct PowerNote {
    pub power_type: u8,
    pub owner: AztecAddress,
}

impl PowerNote {
    pub fn new(power_type: u8, owner: AztecAddress) -> Self {
        Self { power_type, owner }
    }
}
