/**
 * EKKLE SALES OS - Lead Routes
 */

import { Elysia, t } from 'elysia';
import { createLogger } from '../../shared/logger';
import { 
  listLeads, 
  findLeadById, 
  createOrGetLead, 
  updateLead 
} from '../services/leadService';
import { getLeadConversations } from '../services/conversationService';
import { NotFoundError } from '../middleware/errorHandler';

const logger = createLogger('leads-routes');

export const leadsRoutes = new Elysia({ prefix: '/leads' })
  /**
   * Lista leads com paginação e filtros
   */
  .get('/', async ({ query }) => {
    logger.info('Listing leads', { query });
    
    const result = await listLeads({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      status: query.status,
      temperature: query.temperature,
      search: query.search
    });

    return result;
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(t.String()),
      temperature: t.Optional(t.String()),
      search: t.Optional(t.String())
    })
  })

  /**
   * Busca lead por ID
   */
  .get('/:id', async ({ params }) => {
    logger.info('Getting lead', { id: params.id });
    
    const lead = await findLeadById(params.id);
    
    if (!lead) {
      throw new NotFoundError('Lead');
    }

    return {
      success: true,
      data: lead
    };
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  /**
   * Cria novo lead
   */
  .post('/', async ({ body }) => {
    logger.info('Creating lead', { phone: body.phone });
    
    const { lead, isNew } = await createOrGetLead({
      phone: body.phone,
      name: body.name,
      church_name: body.church_name,
      status: body.status as any,
      temperature: body.temperature as any,
      assigned_agent: body.assigned_agent as any,
      metadata: body.metadata
    });

    return {
      success: true,
      data: lead,
      isNew
    };
  }, {
    body: t.Object({
      phone: t.String({ minLength: 10, maxLength: 20 }),
      name: t.Optional(t.String()),
      church_name: t.Optional(t.String()),
      status: t.Optional(t.String()),
      temperature: t.Optional(t.String()),
      assigned_agent: t.Optional(t.String()),
      metadata: t.Optional(t.Record(t.String(), t.Any()))
    })
  })

  /**
   * Atualiza lead
   */
  .patch('/:id', async ({ params, body }) => {
    logger.info('Updating lead', { id: params.id });
    
    const lead = await updateLead(params.id, {
      name: body.name,
      church_name: body.church_name,
      status: body.status as any,
      temperature: body.temperature as any,
      assigned_agent: body.assigned_agent as any,
      metadata: body.metadata
    });

    return {
      success: true,
      data: lead
    };
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      name: t.Optional(t.String()),
      church_name: t.Optional(t.String()),
      status: t.Optional(t.String()),
      temperature: t.Optional(t.String()),
      assigned_agent: t.Optional(t.String()),
      metadata: t.Optional(t.Record(t.String(), t.Any()))
    })
  })

  /**
   * Busca conversações de um lead
   */
  .get('/:id/conversations', async ({ params }) => {
    logger.info('Getting lead conversations', { id: params.id });
    
    const lead = await findLeadById(params.id);
    
    if (!lead) {
      throw new NotFoundError('Lead');
    }

    const conversations = await getLeadConversations(params.id);

    return {
      success: true,
      data: conversations
    };
  }, {
    params: t.Object({
      id: t.String()
    })
  });
