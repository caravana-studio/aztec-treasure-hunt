use aztec::{macros::notes::note, protocol::{traits::Packable, address::AztecAddress}};

/// Private note storing a treasure's position
/// Only the owner can read their treasure locations
#[derive(Eq, Packable)]
#[note]
pub struct TreasureNote {
    pub x: u8,
    pub y: u8,
    pub owner: AztecAddress,
}

impl TreasureNote {
    pub fn new(x: u8, y: u8, owner: AztecAddress) -> Self {
        Self { x, y, owner }
    }
}
