use ::aztec::{
    protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};
use crate::TreasureHunt;

// Sample treasure positions for testing
pub unconstrained fn sample_treasures_player1() -> (u8, u8, u8, u8, u8, u8) {
    // Player 1 places at corners: (0,0), (7,7), (0,7)
    (0, 0, 7, 7, 0, 7)
}

pub unconstrained fn sample_treasures_player2() -> (u8, u8, u8, u8, u8, u8) {
    // Player 2 places in middle area: (3,3), (4,4), (5,5)
    (3, 3, 4, 4, 5, 5)
}

// Helper to create a game and return the assigned game_id
pub unconstrained fn create_game_and_get_id(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
) -> Field {
    // Read next_game_id to know what ID will be assigned
    let game_id: Field = env.public_context_at(contract_address, |context| {
        context.storage_read(TreasureHunt::storage_layout().next_game_id.slot)
    });

    // Create game (ID is auto-assigned)
    env.call_public(player1, TreasureHunt::at(contract_address).create_game());

    game_id
}

// Helper to setup a game with two players
pub unconstrained fn setup_two_player_game(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
    player2: AztecAddress,
) -> Field {
    let game_id = create_game_and_get_id(env, contract_address, player1);
    env.call_public(player2, TreasureHunt::at(contract_address).join_game(game_id));
    game_id
}

// Helper to place treasures for a player
pub unconstrained fn place_player_treasures(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player: AztecAddress,
    game_id: Field,
    positions: (u8, u8, u8, u8, u8, u8)
) {
    let (x1, y1, x2, y2, x3, y3) = positions;
    env.call_private(
        player,
        TreasureHunt::at(contract_address).place_treasures(game_id, x1, y1, x2, y2, x3, y3)
    );
}

// Helper to setup a complete game ready to play
pub unconstrained fn setup_complete_game(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
    player2: AztecAddress,
) -> Field {
    // Create and join game
    let game_id = setup_two_player_game(env, contract_address, player1, player2);

    // Place treasures for both players
    place_player_treasures(env, contract_address, player1, game_id, sample_treasures_player1());
    place_player_treasures(env, contract_address, player2, game_id, sample_treasures_player2());

    game_id
}
