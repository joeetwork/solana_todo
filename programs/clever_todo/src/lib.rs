use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod states;
use crate::{constant::*, error::*, states::*};

declare_id!("6Nxde3XfzkGSA5t5nEP68mCEpvQTHxeHHoes87ZnfsBe");

#[program]
pub mod clever_todo {
    use super::*;

    pub fn initialize_user(
        ctx: Context<InitializeUser>
    ) -> Result<()> {
        // Initialize user profile with default data
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.authority = ctx.accounts.authority.key();
        user_profile.last_repo = 0;
        user_profile.repo_count = 0;

        Ok(())
    }

    pub fn add_repo(ctx: Context<AddRepo>, _repo: String) -> Result<()> {
        let repo_account = &mut ctx.accounts.repo_account;
        let user_profile = &mut ctx.accounts.user_profile;


        repo_account.authority = ctx.accounts.authority.key();
        repo_account.repo = _repo;
        repo_account.last_todo = 0;
        repo_account.todo_count = 0;

            // Increase todo idx for PDA
            user_profile.last_repo = user_profile.last_repo
            .checked_add(1)
            .unwrap();

        // Increase total todo count
        user_profile.repo_count = user_profile.repo_count
            .checked_add(1)
            .unwrap();

        Ok(())
    }

    pub fn add_todo(ctx: Context<AddTodo>, _content: String) -> Result<()> {

        let todo_account = &mut ctx.accounts.todo_account;
        let repo_account = &mut ctx.accounts.repo_account;

        // Fill contents with argument
        todo_account.authority = ctx.accounts.authority.key();
        todo_account.content = _content;
        todo_account.marked = false;

        // Increase todo idx for PDA
        repo_account.last_todo = repo_account.last_todo
            .checked_add(1)
            .unwrap();

        // Increase total todo count
        repo_account.todo_count = repo_account.todo_count
            .checked_add(1)
            .unwrap();

        Ok(())
    }

    pub fn mark_todo(ctx: Context<MarkTodo>, todo_idx: u8) -> Result<()> {
        let todo_account = &mut ctx.accounts.todo_account;
        require!(!todo_account.marked, TodoError::AlreadyMarked);

        // Mark todo
        todo_account.marked = true;
        Ok(())
    }

    pub fn remove_todo(ctx: Context<RemoveTodo>, todo_idx: u8) -> Result<()> {
        // Decreate total todo count
        let repo_account = &mut ctx.accounts.repo_account;
        repo_account.todo_count = repo_account.todo_count
            .checked_sub(1)
            .unwrap();

        // No need to decrease last todo idx

        // Todo PDA already closed in context

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [USER_TAG, authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + std::mem::size_of::<UserProfile>(),
    )]
    pub user_profile: Box<Account<'info, UserProfile>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct AddRepo<'info> {
    #[account(
        mut,
        seeds = [USER_TAG, authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub user_profile: Box<Account<'info, UserProfile>>,

    #[account(
        init,
        seeds = [REPO_TAG, authority.key().as_ref(), &[user_profile.last_repo as u8].as_ref()],
        bump,
        payer = authority,
        space = std::mem::size_of::<UserRepos>() + 8,
    )]
    pub repo_account: Box<Account<'info, UserRepos>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct AddTodo<'info> {
    #[account(
        mut,
        seeds = [REPO_TAG, authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub repo_account: Box<Account<'info, UserRepos>>,

    #[account(
        init,
        seeds = [TODO_TAG, authority.key().as_ref(), &[repo_account.last_todo as u8].as_ref()],
        bump,
        payer = authority,
        space = std::mem::size_of::<UserTickets>() + 8,
    )]
    pub todo_account: Box<Account<'info, UserTickets>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(todo_idx: u8)]
pub struct MarkTodo<'info> {
    #[account(
        mut,
        seeds = [REPO_TAG, authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub repo_account: Box<Account<'info, UserRepos>>,

    #[account(
        mut,
        seeds = [TODO_TAG, authority.key().as_ref(), &[todo_idx].as_ref()],
        bump,
        has_one = authority,
    )]
    pub todo_account: Box<Account<'info, UserTickets>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(todo_idx: u8)]
pub struct RemoveTodo<'info> {
    #[account(
        mut,
        seeds = [REPO_TAG, authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub repo_account: Box<Account<'info, UserRepos>>,

    #[account(
        mut,
        close = authority,
        seeds = [TODO_TAG, authority.key().as_ref(), &[todo_idx].as_ref()],
        bump,
        has_one = authority,
    )]
    pub todo_account: Box<Account<'info, UserTickets>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn is_zero_account(account_info: &AccountInfo) -> bool {
    let account_data: &[u8] = &account_info.data.borrow();
    let len = account_data.len();
    let mut is_zero = true;
    for i in 0..len - 1 {
        if account_data[i] != 0 {
            is_zero = false;
        }
    }
    is_zero
}

pub fn bump(seeds: &[&[u8]], program_id: &Pubkey) -> u8 {
    let (_found_key, bump) = Pubkey::find_program_address(seeds, program_id);
    bump
}
