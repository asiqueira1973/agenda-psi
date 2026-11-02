/**
 * Tipos do banco, GERADOS. Não edite à mão.
 *
 * Origem: `supabase gen types typescript --linked` sobre o projeto
 * tocytpjtupbbxwgamtxq. Regerar depois de toda migration.
 *
 * Os nomes vêm em português porque o banco é em português (spec 18). Isso é
 * proposital: não existe camada de tradução entre `nome_completo` e
 * `fullName`, porque ela só criaria mais um lugar para o nome divergir.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_semana_padrao: {
        Row: {
          criado_em: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          observacoes: string | null
          paciente_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          atualizado_em: string
          expira_em: string | null
          inicio_em: string
          plano: string
          profissional_id: string
          rc_customer_id: string | null
          rc_entitlement: string | null
          status: string
          store: string | null
        }
        Insert: {
          atualizado_em?: string
          expira_em?: string | null
          inicio_em?: string
          plano?: string
          profissional_id: string
          rc_customer_id?: string | null
          rc_entitlement?: string | null
          status?: string
          store?: string | null
        }
        Update: {
          atualizado_em?: string
          expira_em?: string | null
          inicio_em?: string
          plano?: string
          profissional_id?: string
          rc_customer_id?: string | null
          rc_entitlement?: string | null
          status?: string
          store?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: true
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: true
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      comentarios_locais_atendimento: {
        Row: {
          comentario: string
          contexto_uso: string | null
          criado_em: string
          criado_por_usuario_id: string
          id: string
          local_atendimento_id: string
          status: string
        }
        Insert: {
          comentario: string
          contexto_uso?: string | null
          criado_em?: string
          criado_por_usuario_id: string
          id?: string
          local_atendimento_id: string
          status?: string
        }
        Update: {
          comentario?: string
          contexto_uso?: string | null
          criado_em?: string
          criado_por_usuario_id?: string
          id?: string
          local_atendimento_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_locais_atendimento_local_atendimento_id_fkey"
            columns: ["local_atendimento_id"]
            isOneToOne: false
            referencedRelation: "locais_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_locais_atendimento_local_atendimento_id_fkey"
            columns: ["local_atendimento_id"]
            isOneToOne: false
            referencedRelation: "view_locais_atendimento_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      config_app: {
        Row: {
          chave: string
          valor: string | null
        }
        Insert: {
          chave: string
          valor?: string | null
        }
        Update: {
          chave?: string
          valor?: string | null
        }
        Relationships: []
      }
      custos_sms_mensal: {
        Row: {
          atualizado_em: string
          cambio_eur_brl: number
          fatura_numero: string | null
          fechado: boolean
          mensagens_bird: number | null
          mes: string
          observacao: string | null
          valor_eur: number
        }
        Insert: {
          atualizado_em?: string
          cambio_eur_brl: number
          fatura_numero?: string | null
          fechado?: boolean
          mensagens_bird?: number | null
          mes: string
          observacao?: string | null
          valor_eur: number
        }
        Update: {
          atualizado_em?: string
          cambio_eur_brl?: number
          fatura_numero?: string | null
          fechado?: boolean
          mensagens_bird?: number | null
          mes?: string
          observacao?: string | null
          valor_eur?: number
        }
        Relationships: []
      }
      despesas: {
        Row: {
          criado_em: string
          data_competencia: string | null
          descricao: string | null
          id: string
          metodo: string | null
          observacoes: string | null
          pago_em: string | null
          status: string
          tipo_despesa_id: string
          usuario_id: string
          valor_despesa: number
        }
        Insert: {
          criado_em?: string
          data_competencia?: string | null
          descricao?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          tipo_despesa_id: string
          usuario_id: string
          valor_despesa: number
        }
        Update: {
          criado_em?: string
          data_competencia?: string | null
          descricao?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          pago_em?: string | null
          status?: string
          tipo_despesa_id?: string
          usuario_id?: string
          valor_despesa?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_tipo_despesa_id_fkey"
            columns: ["tipo_despesa_id"]
            isOneToOne: false
            referencedRelation: "tipos_despesa"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chave: string
          descricao: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chave: string
          descricao: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chave?: string
          descricao?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_name: string | null
          created_at: string
          email: string | null
          handle_at: string | null
          id: number
          mensagem: string | null
        }
        Insert: {
          app_name?: string | null
          created_at?: string
          email?: string | null
          handle_at?: string | null
          id?: number
          mensagem?: string | null
        }
        Update: {
          app_name?: string | null
          created_at?: string
          email?: string | null
          handle_at?: string | null
          id?: number
          mensagem?: string | null
        }
        Relationships: []
      }
      locais_atendimento: {
        Row: {
          bairro: string | null
          cidade: string
          criado_em: string
          criado_por_usuario_id: string | null
          estado: string
          id: string
          nome: string
          origem: string
          status: string
          tipo_local: string
          url_contato: string | null
        }
        Insert: {
          bairro?: string | null
          cidade: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          estado: string
          id?: string
          nome: string
          origem: string
          status?: string
          tipo_local: string
          url_contato?: string | null
        }
        Update: {
          bairro?: string | null
          cidade?: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          estado?: string
          id?: string
          nome?: string
          origem?: string
          status?: string
          tipo_local?: string
          url_contato?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: number
          is_read: boolean
          recipient_usuario_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: number
          is_read?: boolean
          recipient_usuario_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: number
          is_read?: boolean
          recipient_usuario_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_usuario_fkey"
            columns: ["recipient_usuario_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notifications_usuario_fkey"
            columns: ["recipient_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_adesao_usuarios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notifications_usuario_fkey"
            columns: ["recipient_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_admin_dashboard_usuarios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notifications_usuario_fkey"
            columns: ["recipient_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_custo_sms_mensal_por_profissional"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notifications_usuario_fkey"
            columns: ["recipient_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_profissional_atual"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      pacientes: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          nome_completo: string
          observacoes: string | null
          primeira_consulta: string | null
          profissional_id: string | null
          receber_sms: boolean
          status: string
          telefone: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id?: string
          nome_completo: string
          observacoes?: string | null
          primeira_consulta?: string | null
          profissional_id?: string | null
          receber_sms?: boolean
          status?: string
          telefone?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome_completo?: string
          observacoes?: string | null
          primeira_consulta?: string | null
          profissional_id?: string | null
          receber_sms?: boolean
          status?: string
          telefone?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          criado_em: string
          data_competencia: string | null
          id: string
          metodo: string | null
          observacoes: string | null
          paciente_id: string
          pago_em: string | null
          profissional_id: string | null
          status: string
          tipo: string | null
          usuario_id: string
          valor_pagamento: number
          vencimento_em: string | null
        }
        Insert: {
          criado_em?: string
          data_competencia?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          paciente_id: string
          pago_em?: string | null
          profissional_id?: string | null
          status?: string
          tipo?: string | null
          usuario_id: string
          valor_pagamento: number
          vencimento_em?: string | null
        }
        Update: {
          criado_em?: string
          data_competencia?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          paciente_id?: string
          pago_em?: string | null
          profissional_id?: string | null
          status?: string
          tipo?: string | null
          usuario_id?: string
          valor_pagamento?: number
          vencimento_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "pagamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      precos_paciente: {
        Row: {
          criado_em: string
          id: string
          observacoes: string | null
          paciente_id: string
          preco: number
          profissional_id: string | null
          usuario_id: string
          vigencia_desde: string
        }
        Insert: {
          criado_em?: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          preco: number
          profissional_id?: string | null
          usuario_id: string
          vigencia_desde?: string
        }
        Update: {
          criado_em?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          preco?: number
          profissional_id?: string | null
          usuario_id?: string
          vigencia_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_paciente_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      profissionais: {
        Row: {
          ativo: boolean | null
          criado_em: string
          descadastro_email_em: string | null
          descadastro_email_origem: string | null
          email: string
          fcm_token: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          nome: string
          telefone: string | null
          usuario_fundador: boolean
          usuario_id: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string
          descadastro_email_em?: string | null
          descadastro_email_origem?: string | null
          email: string
          fcm_token?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          nome: string
          telefone?: string | null
          usuario_fundador?: boolean
          usuario_id: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string
          descadastro_email_em?: string | null
          descadastro_email_origem?: string | null
          email?: string
          fcm_token?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          nome?: string
          telefone?: string | null
          usuario_fundador?: boolean
          usuario_id?: string
        }
        Relationships: []
      }
      sessoes: {
        Row: {
          criado_em: string
          devesercobrada: boolean | null
          duracao_minutos: number | null
          id: string
          modalidade: string | null
          observacoes: string | null
          ocorreu_em: string
          ocorreu_em_dia: string
          paciente_id: string
          pagamento: string | null
          profissional_id: string | null
          status: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          devesercobrada?: boolean | null
          duracao_minutos?: number | null
          id?: string
          modalidade?: string | null
          observacoes?: string | null
          ocorreu_em?: string
          ocorreu_em_dia?: string
          paciente_id: string
          pagamento?: string | null
          profissional_id?: string | null
          status?: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          devesercobrada?: boolean | null
          duracao_minutos?: number | null
          id?: string
          modalidade?: string | null
          observacoes?: string | null
          ocorreu_em?: string
          ocorreu_em_dia?: string
          paciente_id?: string
          pagamento?: string | null
          profissional_id?: string | null
          status?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "sessoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      sms_lembretes_enviados: {
        Row: {
          agenda_id: string
          enviado_em: string
          id: string
          ocorrencia_data: string
          ocorrencia_inicio: string
          provider_message_id: string | null
        }
        Insert: {
          agenda_id: string
          enviado_em?: string
          id?: string
          ocorrencia_data: string
          ocorrencia_inicio: string
          provider_message_id?: string | null
        }
        Update: {
          agenda_id?: string
          enviado_em?: string
          id?: string
          ocorrencia_data?: string
          ocorrencia_inicio?: string
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_lembretes_enviados_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda_semana_padrao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_lembretes_enviados_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "v_sms_lembretes_pendentes"
            referencedColumns: ["agenda_id"]
          },
          {
            foreignKeyName: "sms_lembretes_enviados_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "view_agenda_semana_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_despesa: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      uso_mensal: {
        Row: {
          atualizado_em: string
          mes: string
          profissional_id: string
          sms_enviados: number
        }
        Insert: {
          atualizado_em?: string
          mes: string
          profissional_id: string
          sms_enviados?: number
        }
        Update: {
          atualizado_em?: string
          mes?: string
          profissional_id?: string
          sms_enviados?: number
        }
        Relationships: [
          {
            foreignKeyName: "uso_mensal_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uso_mensal_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
    }
    Views: {
      v_adesao_usuarios: {
        Row: {
          email: string | null
          nome_profissional: string | null
          qt_despesas: number | null
          qt_pacientes: number | null
          qt_pagamentos: number | null
          qt_sessoes: number | null
          ultima_atividade_em: string | null
          usuario_id: string | null
          valor_despesas: number | null
          valor_pagamentos: number | null
          valor_sessoes: number | null
        }
        Relationships: []
      }
      v_admin_dashboard_usuarios: {
        Row: {
          despesas_mes_anterior: number | null
          despesas_mes_corrente: number | null
          email: string | null
          pacientes_ativos: number | null
          pagamentos_mes_anterior: number | null
          pagamentos_mes_corrente: number | null
          periodo_mes_anterior_fim_utc: string | null
          periodo_mes_anterior_inicio_utc: string | null
          periodo_mes_corrente_fim_utc: string | null
          periodo_mes_corrente_inicio_utc: string | null
          rentabilidade_mes_anterior: number | null
          rentabilidade_mes_corrente: number | null
          sessoes_mes_anterior: number | null
          sessoes_mes_corrente: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_campanha_despesas: {
        Row: {
          despesas_3m: number | null
          email: string | null
          nome: string | null
          qt_despesas_3m: number | null
          qt_pagamentos_3m: number | null
          receita_3m: number | null
          tipos_usados: string[] | null
        }
        Relationships: []
      }
      v_custo_sms_mensal: {
        Row: {
          custo_total_brl: number | null
          custo_total_eur: number | null
          eur_por_sms: number | null
          fatura_numero: string | null
          fonte: string | null
          mensagens_bird: number | null
          mes: string | null
          total_sms: number | null
        }
        Relationships: []
      }
      v_custo_sms_mensal_por_profissional: {
        Row: {
          custo_total_brl: number | null
          custo_total_eur: number | null
          fonte: string | null
          mes: string | null
          participacao_pct: number | null
          profissional_email: string | null
          profissional_nome: string | null
          total_sms: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_dashboard_payload_json: {
        Row: {
          payload: Json | null
        }
        Relationships: []
      }
      v_dashboard_resumo: {
        Row: {
          break_even_sessoes_mes_corrente: number | null
          custo_medio_por_paciente_mes_corrente: number | null
          despesas_mes_anterior: number | null
          despesas_mes_corrente: number | null
          margem_mes_anterior_pct: number | null
          margem_mes_corrente_pct: number | null
          pacientes_ativos: number | null
          pagamentos_mes_anterior: number | null
          pagamentos_mes_corrente: number | null
          periodo_mes_anterior_fim_utc: string | null
          periodo_mes_anterior_inicio_utc: string | null
          periodo_mes_corrente_fim_utc: string | null
          periodo_mes_corrente_inicio_utc: string | null
          receita_media_por_paciente_mes_corrente: number | null
          receita_media_por_sessao_corrente: number | null
          rentabilidade_mes_anterior: number | null
          rentabilidade_mes_corrente: number | null
          sessoes_mes_anterior: number | null
          sessoes_mes_corrente: number | null
          variacao_despesas_pct: number | null
          variacao_receita_pct: number | null
          variacao_rentabilidade_pct: number | null
          variacao_sessoes_pct: number | null
        }
        Relationships: []
      }
      v_despesas_ultimas_10: {
        Row: {
          criado_em: string | null
          data_competencia: string | null
          data_referencia: string | null
          descricao: string | null
          id: string | null
          metodo: string | null
          observacoes: string | null
          pago_em: string | null
          status: string | null
          tipo_despesa_id: string | null
          tipo_despesa_nome: string | null
          usuario_id: string | null
          valor_despesa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_tipo_despesa_id_fkey"
            columns: ["tipo_despesa_id"]
            isOneToOne: false
            referencedRelation: "tipos_despesa"
            referencedColumns: ["id"]
          },
        ]
      }
      v_despesas_ultimas_30: {
        Row: {
          criado_em: string | null
          data_competencia: string | null
          data_referencia: string | null
          descricao: string | null
          id: string | null
          metodo: string | null
          observacoes: string | null
          pago_em: string | null
          status: string | null
          tipo_despesa_id: string | null
          tipo_despesa_nome: string | null
          usuario_id: string | null
          valor_despesa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_tipo_despesa_id_fkey"
            columns: ["tipo_despesa_id"]
            isOneToOne: false
            referencedRelation: "tipos_despesa"
            referencedColumns: ["id"]
          },
        ]
      }
      v_feedback_email: {
        Row: {
          app_name: string | null
          created_at: string | null
          email: string | null
          email_body: string | null
          handle_at: string | null
          id: number | null
          mensagem: string | null
        }
        Insert: {
          app_name?: string | null
          created_at?: string | null
          email?: string | null
          email_body?: never
          handle_at?: string | null
          id?: number | null
          mensagem?: string | null
        }
        Update: {
          app_name?: string | null
          created_at?: string | null
          email?: string | null
          email_body?: never
          handle_at?: string | null
          id?: number | null
          mensagem?: string | null
        }
        Relationships: []
      }
      v_feedback_email_aggregated: {
        Row: {
          app_name: string | null
          email_body: string | null
          total_feedbacks: number | null
        }
        Relationships: []
      }
      v_financeiro_mensal: {
        Row: {
          mes_referencia: string | null
          pendente: number | null
          recebido: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_meu_plano: {
        Row: {
          expira_em: string | null
          limite_atingido: boolean | null
          limite_sms: number | null
          mes_referencia: string | null
          plano: string | null
          profissional_id: string | null
          sms_restantes: number | null
          sms_usados: number | null
          status: string | null
          store: string | null
          usuario_fundador: boolean | null
        }
        Relationships: []
      }
      v_minha_adesao: {
        Row: {
          despesas: number | null
          nome_profissional: string | null
          pacientes: number | null
          pagamentos: number | null
          sessoes: number | null
        }
        Relationships: []
      }
      v_pacientes_cartao: {
        Row: {
          email: string | null
          nome_completo: string | null
          observacoes: string | null
          paciente_id: string | null
          preco_vigente: number | null
          preco_vigente_desde: string | null
          primeira_consulta: string | null
          receber_sms: boolean | null
          sessoes_nao_pagas: number | null
          sessoes_realizadas: number | null
          status: string | null
          telefone: string | null
          total_sessoes_ate_hoje: number | null
          ultima_sessao: string | null
          usuario_id: string | null
          valor_total_pago_ate_hoje: number | null
        }
        Relationships: []
      }
      v_pacientes_sms_ativos_resumo: {
        Row: {
          consultas_na_agenda_planejada: number | null
          paciente_email: string | null
          paciente_id: string | null
          paciente_nome: string | null
          profissional_email: string | null
          receber_sms: boolean | null
          telefone: string | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_pendencias_por_paciente: {
        Row: {
          nome_completo: string | null
          paciente_id: string | null
          proximo_vencimento: string | null
          qtde_pendencias: number | null
          total_pendente: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_preco_vigente_paciente: {
        Row: {
          nome_completo: string | null
          paciente_id: string | null
          preco: number | null
          usuario_id: string | null
          vigencia_desde: string | null
        }
        Relationships: []
      }
      v_precos_paciente: {
        Row: {
          criado_em: string | null
          id: string | null
          observacoes: string | null
          paciente_id: string | null
          preco: number | null
          profissional_id: string | null
          usuario_id: string | null
          vigencia_desde: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "precos_paciente_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_paciente_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      v_profissional_atual: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string | null
          instagram: string | null
          linkedin: string | null
          nome: string | null
          telefone: string | null
          usuario_id: string | null
        }
        Insert: {
          ativo?: never
          criado_em?: string | null
          email?: string | null
          instagram?: never
          linkedin?: never
          nome?: never
          telefone?: never
          usuario_id?: string | null
        }
        Update: {
          ativo?: never
          criado_em?: string | null
          email?: string | null
          instagram?: never
          linkedin?: never
          nome?: never
          telefone?: never
          usuario_id?: string | null
        }
        Relationships: []
      }
      v_sms_base_mensal: {
        Row: {
          mes: string | null
          total_sms: number | null
          usuario_id: string | null
        }
        Relationships: []
      }
      v_sms_lembretes_pendentes: {
        Row: {
          agenda_id: string | null
          horario_sessao: string | null
          mensagem_sms: string | null
          ocorrencia_data: string | null
          ocorrencia_inicio: string | null
          paciente_id: string | null
          paciente_nome: string | null
          profissional_id: string | null
          profissional_nome: string | null
          telefone: string | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "pacientes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "v_meu_plano"
            referencedColumns: ["profissional_id"]
          },
        ]
      }
      view_agenda_semana_padrao: {
        Row: {
          dia_semana: number | null
          dia_semana_label: string | null
          hora_bloco: number | null
          hora_fim: string | null
          hora_inicio: string | null
          hora_label: string | null
          id: string | null
          observacoes: string | null
          paciente_id: string | null
          paciente_nome: string | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_cartao"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pacientes_sms_ativos_resumo"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_pendencias_por_paciente"
            referencedColumns: ["paciente_id"]
          },
          {
            foreignKeyName: "agenda_semana_padrao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "v_preco_vigente_paciente"
            referencedColumns: ["paciente_id"]
          },
        ]
      }
      view_locais_atendimento_cards: {
        Row: {
          bairro: string | null
          cidade: string | null
          criado_em: string | null
          estado: string | null
          id: string | null
          nome: string | null
          origem: string | null
          status: string | null
          tipo_local: string | null
          total_comentarios_aprovados: number | null
          url_contato: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      agentpsi_consultar_paciente: {
        Args: { p_nome_paciente: string; p_usuario_id: string }
        Returns: Json
      }
      agentpsi_criar_paciente: {
        Args: {
          p_email?: string
          p_nome_completo: string
          p_observacoes?: string
          p_primeira_consulta?: string
          p_telefone?: string
          p_usuario_id: string
        }
        Returns: Json
      }
      agentpsi_dashboard: { Args: { p_usuario_id: string }; Returns: Json }
      agentpsi_listar_despesas_ultimas_30: {
        Args: { p_usuario_id: string }
        Returns: Json
      }
      agentpsi_listar_pacientes_ativos: {
        Args: { p_usuario_id: string }
        Returns: Json
      }
      agentpsi_listar_pagamentos_ultimos_30: {
        Args: { p_usuario_id: string }
        Returns: Json
      }
      agentpsi_registrar_despesa: {
        Args: {
          p_data_competencia: string
          p_descricao: string
          p_metodo: string
          p_nome_tipo_despesa: string
          p_observacoes: string
          p_usuario_id: string
          p_valor_despesa: number
        }
        Returns: Json
      }
      agentpsi_registrar_pagamento: {
        Args: {
          p_data_pagamento?: string
          p_metodo?: string
          p_nome_paciente: string
          p_observacoes?: string
          p_tipo?: string
          p_usuario_id: string
          p_valor_pagamento: number
        }
        Returns: Json
      }
      agentpsi_registrar_sessao: {
        Args: {
          p_duracao_minutos?: number
          p_gerar_pagamento?: boolean
          p_metodo?: string
          p_modalidade?: string
          p_nome_paciente: string
          p_observacoes?: string
          p_ocorreu_em?: string
          p_tipo?: string
          p_usuario_id: string
          p_valor_pagamento?: number
        }
        Returns: Json
      }
      current_profissional_id: { Args: never; Returns: string }
      demo_uid: { Args: never; Returns: string }
      limite_sms_do_plano: {
        Args: { p_profissional_id: string }
        Returns: number
      }
      recontar_uso_mensal: { Args: { p_mes: string }; Returns: number }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
