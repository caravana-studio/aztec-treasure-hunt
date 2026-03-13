use aztec::{macros::notes::note, protocol::{traits::Packable, address::AztecAddress}};

/// Private note storing a trap's position
/// Traps cause the opponent to lose their turn when they dig at that location
#[derive(Eq, Packable)]
#[note]
pub struct TrapNote {
    pub x: u8,
    pub y: u8,
    pub owner: AztecAddress,
}

impl TrapNote {
    pub fn new(x: u8, y: u8, owner: AztecAddress) -> Self {
        Self { x, y, owner }
    }
}
