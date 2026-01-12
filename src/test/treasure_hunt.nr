use crate::TreasureHunt;
use crate::test::utils::setup;
use crate::test::helpers::{
    TEST_GAME_ID_1, TEST_GAME_ID_2, TEST_GAME_ID_3,
    setup_two_player_game, place_player_treasures,
    sample_treasures_player1, sample_treasures_player2
};
use dep::aztec::test::helpers::test_environment::TestEnvironment;

#[test]
unconstrained fn test_create_game() {
    let (mut env, contract_address, _admin) = setup();

    let player1 = env.create_light_account();

    env.call_public(player1, TreasureHunt::at(contract_address).create_game(TEST_GAME_ID_1));

    // Game should exist (we would check public state here)
    // For now, just verify no panic occurred
}

#[test]
unconstrained fn test_join_game() {
    let (mut env, contract_address, _admin) = setup();

    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    setup_two_player_game(&mut env, contract_address, player1, player2, TEST_GAME_ID_1);

    // Both players should be registered (verify no panic)
}

#[test]
unconstrained fn test_place_treasures() {
    let (mut env, contract_address, _admin) = setup();

    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Setup game
    setup_two_player_game(&mut env, contract_address, player1, player2, TEST_GAME_ID_2);

    // Place treasures for player1
    place_player_treasures(
        &mut env,
        contract_address,
        player1,
        TEST_GAME_ID_2,
        sample_treasures_player1()
    );

    // Place treasures for player2
    place_player_treasures(
        &mut env,
        contract_address,
        player2,
        TEST_GAME_ID_2,
        sample_treasures_player2()
    );

    // Both players should have treasures placed (verify no panic)
}

#[test(should_fail)]
unconstrained fn test_cannot_place_duplicate_positions() {
    let (mut env, contract_address, _admin) = setup();

    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    setup_two_player_game(&mut env, contract_address, player1, player2, TEST_GAME_ID_3);

    // Try to place two treasures at the same position - should fail
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).place_treasures(
            TEST_GAME_ID_3,
            0, 0,  // First treasure
            0, 0,  // Same position - invalid!
            1, 1   // Third treasure
        )
    );
}

#[test(should_fail)]
unconstrained fn test_cannot_place_out_of_bounds() {
    let (mut env, contract_address, _admin) = setup();

    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    setup_two_player_game(&mut env, contract_address, player1, player2, TEST_GAME_ID_3);

    // Try to place treasure outside 8x8 grid - should fail
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).place_treasures(
            TEST_GAME_ID_3,
            0, 0,
            10, 10,  // Out of bounds!
            1, 1
        )
    );
}
